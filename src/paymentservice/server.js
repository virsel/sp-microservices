// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// import { connect, StringCodec } from "nats";
const nats = require('nats');

// NATS_URL aus Umgebungsvariable nehmen
const server = process.env.NATS_URL;

// Codec zur Serialisierung und Deserialisierung erstellen
const sc = nats.StringCodec();

const path = require('path');
const grpc = require('@grpc/grpc-js');
const pino = require('pino');
const protoLoader = require('@grpc/proto-loader');

const charge = require('./charge');
const {connect, StringCodec} = require("nats");

// logger einrichten
const logger = pino({
    name: 'paymentservice-server',
    messageKey: 'message',
    formatters: {
        level(logLevelString, logLevelNum) {
            return {severity: logLevelString}
        }
    }
});

class PaymentServer {
    constructor(protoRoot, port = PaymentServer.PORT) {
        this.port = port;

        this.packages = {
            shop_i_rpc: this.loadProto(path.join(protoRoot, 'shop.proto')),
            health: this.loadProto(path.join(protoRoot, 'grpc/health/v1/health.proto'))
        };

        this.server = new grpc.Server();
        this.loadAllProtos(protoRoot);

        connect({servers: server}).then(value => {
            this.nc = value
            logger.info(`Established nats-jetstream connection to addr: ${server}`);
            this.subscribe()
        });
    }

    /**
     * Handler for PaymentService.Charge.
     * @param {*} call  { ChargeRequest }
     * @param {*} callback  fn(err, ChargeResponse)
     */
    static ChargeServiceHandler(call, callback) {
        try {
            logger.info(`PaymentService#Charge invoked with request ${JSON.stringify(call)}`);
            const response = charge(call);
            callback(null, response.transaction_id);
        } catch (err) {
            console.warn(err);
            callback(err);
        }
    }

    /**
     * Handler for PaymentService.CheckHandler.
     * @param {*} call  { ChargeRequest }
     * @param {*} callback  fn(err, ChargeResponse)
     */
    static CheckHandler(call, callback) {
        callback(null, {status: 'SERVING'});
    }

    /**
     * Legt den Port fest, startet den Server und abonniert NATS Nachrichten.
     */
    listen() {
        const server = this.server;
        const port = this.port;

        server.bindAsync(
            `[::]:${port}`,
            grpc.ServerCredentials.createInsecure(),
            function () {
                logger.info(`Test PaymentService gRPC server started on port ${port}`);
                server.start();
            }
        );
    }

    /**
     * Abonniert ORDER.new NATS Nachrichten.
     */
    subscribe() {
        const processingPaymentRequest = "PAYMENTS.process"

        // create a codec
        const sc = StringCodec();

        const subscription = this.nc.subscribe(processingPaymentRequest);
        (async (sub) => {
            console.log(`listening for ${sub.getSubject()} requests...`);
            for await (const m of sub) {
                console.log(`message data: ${m.data}`);
                PaymentServer.ChargeServiceHandler(JSON.parse(sc.decode(m.data)), async function (err, result) {
                    if (err) {
                        logger.error(err.msg);
                    } else {
                        logger.info(`sending reply ${sc.encode(result)} to subject ${sub.getSubject()}`);
                        if (m.respond(sc.encode(result))) {
                            console.info(`[time] handled #${sub.getProcessed()}`);
                        } else {
                            console.log(`[time] #${sub.getProcessed()} ignored - no reply subject`);
                        }
                    }
                });

            }
            console.log(`subscription ${sub.getSubject()} drained.`);
        })(subscription);
    }

    loadProto(path) {
        const packageDefinition = protoLoader.loadSync(
            path,
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            }
        );
        return grpc.loadPackageDefinition(packageDefinition);
    }

    loadAllProtos(protoRoot) {
        const healthPackage = this.packages.health.grpc.health.v1;

        this.server.addService(
            healthPackage.Health.service,
            {
                check: PaymentServer.CheckHandler.bind(this)
            }
        );
    }
}

PaymentServer.PORT = process.env.PORT;

module.exports = PaymentServer;
