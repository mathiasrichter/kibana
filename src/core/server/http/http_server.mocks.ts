/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Request } from 'hapi';
import { merge } from 'lodash';
import { Socket } from 'net';
import { stringify } from 'query-string';

import { schema } from '@kbn/config-schema';

import {
  KibanaRequest,
  LifecycleResponseFactory,
  RouteMethod,
  KibanaResponseFactory,
  RouteValidationSpec,
  KibanaRouteState,
} from './router';
import { OnPreResponseToolkit } from './lifecycle/on_pre_response';
import { OnPostAuthToolkit } from './lifecycle/on_post_auth';
import { OnPreAuthToolkit } from './lifecycle/on_pre_auth';

interface RequestFixtureOptions<P = any, Q = any, B = any> {
  auth?: { isAuthenticated: boolean };
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: Record<string, any>;
  query?: Record<string, any>;
  path?: string;
  method?: RouteMethod;
  socket?: Socket;
  routeTags?: string[];
  kibanaRouteState?: KibanaRouteState;
  routeAuthRequired?: false;
  validation?: {
    params?: RouteValidationSpec<P>;
    query?: RouteValidationSpec<Q>;
    body?: RouteValidationSpec<B>;
  };
}

function createKibanaRequestMock<P = any, Q = any, B = any>({
  path = '/path',
  headers = { accept: 'something/html' },
  params = {},
  body = {},
  query = {},
  method = 'get',
  socket = new Socket(),
  routeTags,
  routeAuthRequired,
  validation = {},
  kibanaRouteState = { xsrfRequired: true },
  auth = { isAuthenticated: true },
}: RequestFixtureOptions<P, Q, B> = {}) {
  const queryString = stringify(query, { sort: false });

  return KibanaRequest.from<P, Q, B>(
    createRawRequestMock({
      auth,
      headers,
      params,
      query,
      payload: body,
      path,
      method,
      url: {
        path,
        pathname: path,
        query: queryString,
        search: queryString ? `?${queryString}` : queryString,
      },
      route: {
        settings: { tags: routeTags, auth: routeAuthRequired, app: kibanaRouteState },
      },
      raw: {
        req: { socket },
      },
    }),
    {
      params: validation.params || schema.any(),
      body: validation.body || schema.any(),
      query: validation.query || schema.any(),
    }
  );
}

type DeepPartial<T> = T extends any[]
  ? DeepPartialArray<T[number]>
  : T extends object
  ? DeepPartialObject<T>
  : T;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DeepPartialArray<T> extends Array<DeepPartial<T>> {}

type DeepPartialObject<T> = { [P in keyof T]+?: DeepPartial<T[P]> };

function createRawRequestMock(customization: DeepPartial<Request> = {}) {
  return merge(
    {},
    {
      app: { xsrfRequired: true } as any,
      auth: {
        isAuthenticated: true,
      },
      headers: {},
      path: '/',
      route: { settings: {} },
      url: {
        href: '/',
      },
      raw: {
        req: {
          url: '/',
        },
      },
    },
    customization
  ) as Request;
}

const createResponseFactoryMock = (): jest.Mocked<KibanaResponseFactory> => ({
  ok: jest.fn(),
  accepted: jest.fn(),
  noContent: jest.fn(),
  custom: jest.fn(),
  redirected: jest.fn(),
  badRequest: jest.fn(),
  unauthorized: jest.fn(),
  forbidden: jest.fn(),
  notFound: jest.fn(),
  conflict: jest.fn(),
  internalError: jest.fn(),
  customError: jest.fn(),
});

const createLifecycleResponseFactoryMock = (): jest.Mocked<LifecycleResponseFactory> => ({
  redirected: jest.fn(),
  badRequest: jest.fn(),
  unauthorized: jest.fn(),
  forbidden: jest.fn(),
  notFound: jest.fn(),
  conflict: jest.fn(),
  internalError: jest.fn(),
  customError: jest.fn(),
});

type ToolkitMock = jest.Mocked<OnPreResponseToolkit & OnPostAuthToolkit & OnPreAuthToolkit>;

const createToolkitMock = (): ToolkitMock => {
  return {
    next: jest.fn(),
    rewriteUrl: jest.fn(),
  };
};

export const httpServerMock = {
  createKibanaRequest: createKibanaRequestMock,
  createRawRequest: createRawRequestMock,
  createResponseFactory: createResponseFactoryMock,
  createLifecycleResponseFactory: createLifecycleResponseFactoryMock,
  createToolkit: createToolkitMock,
};
