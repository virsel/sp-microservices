[GoogleCloudPlatform microservices-demo ](https://github.com/GoogleCloudPlatform/microservices-demo)
served as a model for this project.

#### RUN

```docker-compose up```

#### REBUILD SINGLE SERVICE
```docker-compose build --no-cache service-name```

#### SETUP NATS-SERVER
- install nats-cli  
```
nats stream add "PAYMENTS"
? Subjects *
? Storage file
? Replication 1
? Retention Policy Limits
? Discard Policy Old
? Stream Messages Limit -1
? Per Subject Messages Limit -1
? Total Stream Size -1
? Message TTL -1
? Max Message Size -1
? Duplicate tracking time window 2m0s
? Allow message Roll-ups No
? Allow message deletion Yes
? Allow purging subjects or the entire stream Yes
Stream PAYMENTS was created
```