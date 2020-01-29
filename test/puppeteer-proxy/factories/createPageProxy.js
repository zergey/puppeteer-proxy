// @flow

import test from 'ava';
import sinon from 'sinon';
import createPageProxy from '../../../src/factories/createPageProxy';
import createHttpProxyServer from '../../helpers/createHttpProxyServer';
import createHttpServer from '../../helpers/createHttpServer';
import createPage from '../../helpers/createPage';

test('makes a HTTP request (without proxy)', async (t) => {
  t.plan(2);

  const requestHandler = sinon.stub().callsFake((incomingRequest, outgoingRequest) => {
    outgoingRequest.end('foo');
  });

  const httpServer = await createHttpServer(requestHandler);

  await createPage(async (page) => {
    const response = await page.goto(httpServer.url);

    t.is(await response.text(), 'foo');
  });

  t.true(requestHandler.called);
});

test('proxies a GET request', async (t) => {
  t.plan(2);

  const requestHandler = sinon.stub().callsFake((incomingRequest, outgoingRequest) => {
    outgoingRequest.end('foo');
  });

  const httpServer = await createHttpServer(requestHandler);

  const httpProxyServer = await createHttpProxyServer();

  await createPage(async (page) => {
    const pageProxy = createPageProxy({
      page,
      proxyUrl: httpProxyServer.url,
    });

    await page.setRequestInterception(true);

    page.once('request', async (request) => {
      await pageProxy.proxyRequest(request);
    });

    const response = await page.goto(httpServer.url);

    t.is((await response.headers())['x-foo'], 'bar');
  });

  t.true(requestHandler.called);
});

test('sets cookies for the succeeding proxy requests', async (t) => {
  t.plan(2);

  const requestHandler = sinon.stub()
    .onCall(0)
    .callsFake((incomingRequest, outgoingRequest) => {
      outgoingRequest.setHeader('set-cookie', 'foo=bar');
      outgoingRequest.end('foo');
    })
    .onCall(1)
    .callsFake((incomingRequest, outgoingRequest) => {
      t.is(incomingRequest.headers.cookie, 'foo=bar');

      outgoingRequest.end('bar');
    });

  const httpServer = await createHttpServer(requestHandler);

  const httpProxyServer = await createHttpProxyServer();

  await createPage(async (page) => {
    const pageProxy = createPageProxy({
      page,
      proxyUrl: httpProxyServer.url,
    });

    await page.setRequestInterception(true);

    page.on('request', async (request) => {
      await pageProxy.proxyRequest(request);
    });

    await page.goto(httpServer.url);

    await page.goto(httpServer.url);
  });

  t.is(requestHandler.callCount, 2);
});