# AWS Kinesis Video Streams with WebRTC Client by React

You can use this project to use AWS Kinesis Video Streams with WebRTC in React project.

## Overview

AWS provides us [an official SDK](https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-js) to use Amazon Kinesis Video Streams Signaling Service for WebRTC streaming.
It includes an example WebRTC Test Page to let us run the service locally but the source code is written in just HTML and JavaScript.
This project aims to let us run the WebRTC Test Page with React.

## Quick Start

### Create `.env.local` file and set necessary secrets

Create `.env.local` file at project root and copy and paste the contents of `.env`.
Now the variables are blank, so fill the necessary secrets you can get from AWS Management Console.

### Install dependencies and Run

Just run with `npm start`. Before the first time you run this project, install dependencies with `npm install`.

## Structure

### `src/api`

This directory includes classes for Kinesis Video Streams client; `KinesisVideoStreamsMasterClient` is for master role and `KinesisVideoStreamsViewerClient` is for viewer role.
Just create a instance of the classes depending on the role of your app.
Take a look at `src/components` directory to see how the use case.

### `src/components`

This directory includes view components for Kinesis Video Streams.
There are two kinds of components, one is for master role and the other is viewer role.
The components uses the classes mentioned above, so you may see how to use the classes.
