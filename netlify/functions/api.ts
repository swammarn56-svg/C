import serverless from "serverless-http";
import { createApp } from "../../server/_core/runtime";

export const handler = serverless(createApp());
