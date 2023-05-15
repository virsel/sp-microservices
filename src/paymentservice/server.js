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

// logger einrichten
const logger = pino({
  name: 'paymentservice-server',
  messageKey: 'message',
  formatters: {
    level(logLevelString, logLevelNum) {
      return { severity: logLevelString }
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
  }

  /**
   * Handler for PaymentService.Charge.
   * @param {*} call  { ChargeRequest }
   * @param {*} callback  fn(err, ChargeResponse)
   */
  static ChargeServiceHandler(call, callback) {
    try {
      logger.info(`PaymentService#Charge invoked with request ${JSON.stringify(call.request)}`);
      const response = charge(call.request);
      callback(null, response);
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
    callback(null, { status: 'SERVING' });
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
  async subscribe() {
    // als Client mit NATS Server verbinden
    try {
      const nc = await nats.connect({
        servers: server,
      });      
    } catch (error) {
      logger.warn(error.message);
      return;
    }

    let subscription = nc.subscribe("ORDER.new");

    (async (sub) => {
      logger.info(`subscribed to subject ${sub.getSubject()}`);

      // auf Nachrichten warten
      for await (const msg of sub) {
        // Daten in der Nachricht dekodieren, bei Fehler Log ausgeben
        this.ChargeServiceHandler(sc.decode(msg.data), function (err, result) {
          if (err) {
            logger.err(err.msg);
          } else {
            nc.publish("PAYMENT.finished", sc.encode(result));
          }
        });
      }

      console.log(`subscription ${sub.getSubject()} processed`);
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
    const shopIRpc = this.packages.shop_i_rpc.shop_i_rpc;
    const healthPackage = this.packages.health.grpc.health.v1;

    this.server.addService(
      shopIRpc.PaymentService.service,
      {
        charge: PaymentServer.ChargeServiceHandler.bind(this)
      }
    );

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
