[GoogleCloudPlatform microservices-demo ](https://github.com/GoogleCloudPlatform/microservices-demo)
served as a model for this project.

#### RUN

```docker-compose up```

#### REBUILD SINGLE SERVICE
```docker-compose build --no-cache service-name```

#### SETUP NATS-SERVER
- install nats-cli  
```nats stream add "PAYMENTS.*"```
