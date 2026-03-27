import { InferRouterInputs, InferRouterOutputs } from '@orpc/server';

import accountRouter from './routers/account';
import bookRouter from './routers/book';
import configRouter from './routers/config';
import externalSystemRouter from './routers/external-system';
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
  externalSystem: externalSystemRouter,
  genre: genreRouter,
  personalData: personalDataRouter,
  role: roleRouter,
  systemConfig: systemConfigRouter,
  user: userRouter,
  config: configRouter,
};
