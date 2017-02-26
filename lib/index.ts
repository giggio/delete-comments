global.log = require('debug')('delete-comments');
import { config } from './config';
import { FB } from 'fb';
// import { FB, FacebookApiException } from 'fb';
import { promisify } from 'bluebird';
import { Keys } from './keys';
import * as url from 'url';

FB.options({
    appId: config.facebook.appId,
    appSecret: config.facebook.appSecret,
    redirectUri: config.facebook.redirectUri
});
const napi = promisify(<(path: string, method: HTTPMethods, callback: (error: any, response: any) => void) => void>FB.napi, FB);
const napiF = promisify(<(path: string, method: HTTPMethods, params: object, callback: (error: any, response: any) => void) => void>FB.napi, FB);
// const commentId = 123;
// const postId = 1238139626221232;
let userAccessToken: string = config.facebook.accessToken;
let appAccessToken: string;
let keys = new Keys();
let userId: string;
async function Start() {
    log('Starting');
    try {
        await keys.init();
        await getUserAccessToken();
        await checkUserAccessToken();
    } catch (error) {
        log(`Got an error when managing tokens\n`, error);
        process.exit(1);
    }
    userId = await getUserId();
    while (true) {
        try {
            await checkUserAccessToken();
            await getPosts();
        } catch (error) {
            // todo
        }
        await sleep(5000);
    }
}

async function getUserAccessToken() {
    const token = await keys.getUserAccessToken();
    if (token) {
        log('Got user token from db.');
        userAccessToken = token;
    } else {
        log('Did not get user token from db. Storing the existing one.');
        if (!userAccessToken)
            throw new Error('We don\'t have a valid access token to start');
        await keys.setUserAccessToken(userAccessToken);
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAppAccessToken() {
    const getAppAccessTokenResponse = await napiF(`/oauth/access_token`, 'get', {
        client_id: config.facebook.appId,
        client_secret: config.facebook.appSecret,
        grant_type: 'client_credentials'
    });
    appAccessToken = getAppAccessTokenResponse.access_token;
}

let lastUserTokenDebug: UserTokenDebug;
async function checkUserAccessToken() {
    log(`Checking user access token...`);
    if (!lastUserTokenDebug) {
        await checkAppAccessToken();
        lastUserTokenDebug = <UserTokenDebug>await checkToken(userAccessToken);
    }
    const tokenExpiresIn = new Date(lastUserTokenDebug.expires_at * 1000);
    log(`Current user token expires in ${tokenExpiresIn}`);
    const inAWeek = new Date(new Date().setDate(new Date().getDate() + 7));
    if (inAWeek > tokenExpiresIn) {
        log(`User token expires in less than a week. Renewing...`);
        await renewUserToken();
        log(`Check user token again...`);
        lastUserTokenDebug = <UserTokenDebug>await checkToken(userAccessToken);
        await checkUserAccessToken();
    }
    await keys.setUserAccessToken(userAccessToken);
    FB.setAccessToken(userAccessToken);
}

async function renewUserToken() {
    await checkAppAccessToken();
    const res = await napiF('oauth/access_token', 'get', {
        client_id: config.facebook.appId,
        client_secret: config.facebook.appSecret,
        grant_type: 'fb_exchange_token',
        fb_exchange_token: userAccessToken
    });
    userAccessToken = res.access_token;
    log(`New token is ${userAccessToken}`);
}

async function checkAppAccessToken() {
    log(`Checking app access token...`);
    if (!appAccessToken)
        await getAppAccessToken();
    let tokenDebug: AppTokenDebug | null = null;
    try {
        tokenDebug = await checkToken(appAccessToken);
    } catch (error) {
    }

    if (tokenDebug === null) {
        log(`App token is invalid. Renewing...`);
        await getAppAccessToken();
        let success = false;
        while (!success) {
            success = await checkAppAccessToken();
            await sleep(60000);
        }
    }
    return true;
}
interface AppTokenDebug {
    app_id: string,
    application: string,
    is_valid: boolean,
    scopes: Array<string>
}

interface UserTokenDebug extends AppTokenDebug {
    expires_at: number,
    user_id: string
}

async function checkToken(accessToken: string): Promise<AppTokenDebug> {
    FB.setAccessToken(appAccessToken);
    const debugApiResponse = await napiF(`debug_token`, 'get', { input_token: accessToken });
    log('Got token debug: ', debugApiResponse);
    return debugApiResponse.data;
}
async function getUserId() {
    const meResponse = await napi(`/me`, 'get');
    log('id: ', JSON.stringify(meResponse));
    const id = <string>meResponse.id;
    return id;
}

let posts: Array<Post> = [];
async function getPosts() {
    const lastDate = posts.length
        ? encodeURIComponent(posts[0].created_time)
        : 'yesterday';
    const newPosts = await getPaged<Post>(`/${userId}/posts?since=${lastDate}&limit=100`);
    posts = posts.concat(newPosts);
    if (posts.length > 30) posts.length = 30;
    const comments = await getAllComments();
    await deleteComments(comments);
}

// does not work, you get a 403 (Forbidden) with a message: (#200) Users can only delete their own comments published by the same app
async function deleteComments(comments: Array<Comment>) {
    const batch = comments.map(c => ({ method: 'DELETE', relative_url: `/${c.id}` }));
    const commentsDeleteBatchResponse = <Array<Batch>>await napiF('', 'post', { batch: batch });
    const notDeletedComments = commentsDeleteBatchResponse
        .map((v, i) => ({comment: comments[i], response: v}))
        .filter(c => c.response.code !== 200);
    if (notDeletedComments.length) {
        log(`Some comments not deleted: ${JSON.stringify(notDeletedComments)}.`);
    }
}

async function getPaged<T>(startUrl: string): Promise<Array<T>> {
    let resourceUrl: string | undefined = startUrl;
    let resources: Array<T> = [];
    const pathName = url.parse(startUrl).pathname;
    while (true) {
        log(`Getting data from ${resourceUrl}...`);
        let response: any;
        try {
            response = await napi(resourceUrl, 'get');
        } catch (error) {
            log(`Got an error: `, error);
            return resources;
        }
        log(`Response:\n`, response);
        for (const post of response.data) {
            resources.push(post);
        }
        if (!response.paging || !response.paging.next)
            break;
        const nextUrl = url.parse(response.paging.next);
        resourceUrl = `${pathName}${nextUrl.search}`;
    }
    return resources;
}

async function getAllComments() {
    const batch = posts.map(p => ({ method: 'GET', relative_url: `/${p.id}/comments` }));
    const commentsBatchResponse = <Array<Batch>>await napiF('', 'post', { batch: batch });
    const comments = <Array<Comment>>commentsBatchResponse.filter(c => c.code === 200)
        .map(c => JSON.parse(c.body).data)
        .reduce((previous, current) => previous.concat(...current), []);
    if (comments.length)
        log(`${comments.length} comment(s):\n${JSON.stringify(comments)}`);
    else
        log(`No comments.`);
    return comments;
}

interface Batch {
    code: Number,
    headers: Array<{name: string, value: string}>,
    body: string
}

interface Post {
    message: string,
    created_time: string,
    id: string
}

interface Comment {
    created_time: string,
    from: {
        name: string,
        id: string
    },
    message: string,
    id: string
}

Start();