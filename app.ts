import bodyParser from 'body-parser';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { origin } from './env';

export const app = express();

app.use(cors({ credentials: true, origin }));
app.use(bodyParser.json());
app.use(cookieParser());

app.get('/_ping', (req, res) => {
  res.send('pong');
});
