import * as Koa from 'koa';
import * as json from 'koa-json';
import * as bodyParser from 'koa-bodyparser';
import * as Router from 'koa-router';
import * as http from 'http';
const convert = require('koa-convert');
import { config } from './config';
global.log = require('debug')('delete-comments');
const app = new Koa();
app.use(convert(json()));
app.use(bodyParser());

const router = new Router();
router.get('/facebook', async ctx => {
    if (ctx.request.query['hub.mode'] === 'subscribe'
    && ctx.request.query['hub.verify_token'] === config.facebook.subscriptionVerifyToken) {
        log('Got positive verification request.');
        ctx.body = ctx.request.query['hub.challenge'];
    } else {
        log('Got FAILED verification request.');
        ctx.status = 400;
    }
});
router.get('/', async ctx => {
    ctx.body = 'Working';
});
router.post('/facebook', async ctx => {
    if (ctx.request.query['hub.verify_token'] !== config.facebook.subscriptionVerifyToken) {
        log('Got FAILED POST request.');
        ctx.status = 400;
        return;
    }
    log(`Got request: ${JSON.stringify(ctx.request.body)}`);
    ctx.status = 200;
});
app.use(router.routes()).use(router.allowedMethods());

const port = normalizePort(process.env.PORT || '3000');
function normalizePort(val: string) {
    const p = parseInt(val, 10);
    if (isNaN(p))
        return val;
    if (p >= 0)
        return p;
    return false;
}
const server = http.createServer(app.callback());
log(`Listening on port ${port}.`);
server.listen(port);