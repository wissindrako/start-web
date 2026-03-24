import { InferRouterInputs, InferRouterOutputs } from '@orpc/server';

import accountRouter from './routers/account';
import bookRouter from './routers/book';
import configRouter from './routers/config';
import genreRouter from './routers/genre';
import personalDataRouter from './routers/personal-data';
import roleRouter from './routers/role';
import systemConfigRouter from './routers/system-config';
import userRouter from './routers/user';

export type Router = typeof router;
export type Inputs = InferRouterInputs<typeof router>;
export type Outputs = InferRouterOutputs<typeof router>;
export const router = {
  account: accountRouter,
  book: bookRouter,
  genre: genreRouter,
  personalData: personalDataRouter,
  role: roleRouter,
  systemConfig: systemConfigRouter,
  user: userRouter,
  config: configRouter,
};
