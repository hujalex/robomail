Robomail - AgentMail Clone

Robomail serves to provide an API interface enabling agents and humans alike to deploy and manage email inboxes programmatically. Robomail manages the underlying infrastructure


Database
We leverage NeonDB to store required information including accounts, inboxes, messages, and message threads


Mailing Service
- Resend provides an inbound email service that makes a POST request to our API server whenever an email address receives a new message. Our API Server contains a webhook to process the POST request on-demand.
- Resend furthermore provides an outbound email service that allows us to send emails to other email addresses

Software Development Kit (SDK)

Robomail's HTTP API server follows the OpenAPI standard enabling straightforward SDK generation in TypeScript through fern. The SDK provides an interface to programmatically interact with the robomail HTTP API server to manage agent inboxes.

Update SDK flow
1. Change to teh API server or OpenAPI specification
2. Push code normally to the repository
3. To release: git tag vx.x.x && git push --tags
4. Riggers the workflow - Fern generates the SDK and publishes to npm 

Sending Emails


Receiving Emails


If no domain is provided set the domain to connectmecybersecurity.org

Seems like threads, messages are only recorded for email addresses with a valid inbox
sendMessage from the sdk currently doesn't throw an error for an uinitialized inbox