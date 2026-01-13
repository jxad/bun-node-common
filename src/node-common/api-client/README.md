# ApiClient

## Description
`ApiClient` is a wrapper around **Axios** that:
- Automatically propagates tracing headers (`traceparent`, `x-trace-id`, `x-request-id`).
- Logs every HTTP call with duration and status.
- Supports automatic retries on network errors or `5xx` responses.

## Usage
```ts
import { ApiClient } from "./client/api-client";
import { SeqLoggerFactory } from "./logging/seq-logger-factory";

const loggerFactory = new SeqLoggerFactory({
  applicationName: "my-app",
  instanceId: "local",
  seqServerUrl: "http://localhost:5341",
});

const client = new ApiClient({
  baseURL: "https://jsonplaceholder.typicode.com",
  loggerFactory,
  serviceName: "JsonPlaceholder",
  retries: 2
});

(async () => {
  const res = await client.get("/posts/1");
  console.log(res.data);
})();
```