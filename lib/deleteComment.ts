import { config } from './config';
import { FB } from 'fb';
// import { FB, FacebookApiException } from 'fb';
import { promisify } from 'bluebird';
FB.options({
    appId: config.facebook.appId,
    appSecret: config.facebook.appSecret,
    redirectUri: config.facebook.redirectUri
});
const napi = promisify(<(path: string, method: HTTPMethods, callback?: (error: any, response: any) => void) => void>FB.napi, FB);
// const commentId = 123;
const postId = 1238139626221232;
log('starting');
FB.setAccessToken(config.facebook.accessToken);
async function Go() {
    try {
        const meResponse = await napi(`/me`, 'get');
        log(meResponse);
        const userId = meResponse.id;
        const postCommentsResponse = await napi(`/${userId}_${postId}/comments`, 'get');
        log(1234);
        log(postCommentsResponse);
        // const response = await napi(`/${commentId}`, 'get');
    } catch (error) {
        log(5555);
        log(error);
    }
}
Go();