import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as http from 'http';
import { config } from './config';
const app = new Koa();

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
router.post('/', async ctx => {
    ctx.body = 'Working';
});
router.post('/facebook', async ctx => {
    log(ctx);
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
server.listen(port);