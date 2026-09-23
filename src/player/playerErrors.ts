export interface PlayerErrorInfo {
  reason: string
  fix: string
}

/** Explains an IFrame API `onError` code and what to change on YouTube (VID-4, PRD §4.4). */
export function describePlayerError(code: number): PlayerErrorInfo {
  switch (code) {
    case 2:
      return { reason: 'YouTube rejected the video id.', fix: 'Delete this video and add it again from a fresh link.' }
    case 5:
      return {
        reason: 'The browser could not play this video.',
        fix: 'Reload the page. If it keeps failing, try another browser.',
      }
    case 100:
      return {
        reason: 'The video is private or was removed.',
        fix: 'In YouTube Studio set the visibility to Public or Unlisted. Private videos never play in an embedded player.',
      }
    case 101:
    case 150:
      // YouTube also reports 150 for videos that are private or no longer exist.
      return {
        reason: 'YouTube does not allow this video to play here: embedding is turned off, or the video is private or removed.',
        fix:
          'In YouTube Studio open the video → Details → Show more → tick “Allow embedding”, and set visibility to Public or Unlisted.',
      }
    case 153:
      return {
        reason: 'YouTube refused the player because the page did not identify itself.',
        fix: 'Disable privacy extensions that strip the Referer header for this site, then reload.',
      }
    default:
      return { reason: `YouTube reported error ${code}.`, fix: 'Reload the page; if it persists, open the video on YouTube to check it plays there.' }
  }
}
