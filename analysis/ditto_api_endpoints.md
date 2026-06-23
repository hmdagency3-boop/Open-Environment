# Ditto Live API Endpoints
**App:** com.ditto.mobile v1.3.4.0  
**Extracted from:** APK decompile (smali → UriProvider.smali)

---

## Base URLs

| Role | URL |
|------|-----|
| **Main API (Production)** | `https://www.sayyouditto.com` |
| **CDN / Resources** | `https://res.sayyouditto.com` |
| **Games Server** | `https://hule.games.sayyouditto.com` |
| **Beta API** | `http://beta.ditto.wooyavip.com` |
| **Beta Resources** | `http://ditto.res.wooyavip.com` |

---

## 🔐 Authentication & Account

| Endpoint | Notes |
|----------|-------|
| `POST /acc/third/login` | Main login (Google/Facebook/Apple) — sends `turingToken`, AES-encrypted body |
| `POST /acc/sms` | Send SMS verification code |
| `GET /acc/sms/filter` | SMS filter check |
| `POST /acc/setPsw` | Set password |
| `POST /acc/pwd/reset` | Reset password |
| `GET /acc/getBaseInfo` | Get account base info |
| `POST /acc/logout` | Logout |
| `POST /acc/cancelAccount` | Delete account |
| `POST /acc/checkBindByPhone` | Check phone binding status |
| `POST /acc/online` | Heartbeat / online status |
| `POST /acc/setThird` | Set third-party binding |
| `POST /acc/security/v2/state` | Security state |
| `POST /acc/security/v2/phone/sendCode` | Send phone verification code |
| `POST /acc/security/v2/phone/submit` | Submit phone verification |
| `POST /acc/security/v2/safe/sendCode` | Send safety code |
| `POST /acc/security/v2/safe/verify` | Verify safety code |
| `POST /acc/security/v2/third/bind` | Bind third-party account |
| `POST /acc/security/v2/third/unbind` | Unbind third-party account |
| `POST /acc/security/v2/password/forgot/sendCode` | Forgot password — send code |
| `POST /acc/security/v2/password/forgot/verify` | Forgot password — verify code |
| `POST /acc/security/v2/password/forgot/submit` | Forgot password — submit new |
| `POST /acc/security/v2/password/reset` | Reset password (v2) |

---

## 🛡️ Risk & Turing Shield

| Endpoint | Notes |
|----------|-------|
| `POST /user/turingShield` | Initialize Turing risk detection — returns turingToken validity |
| `GET /banned/checkBanned` | Check if user/device is banned |

---

## 🎫 OAuth & Tickets

| Endpoint | Notes |
|----------|-------|
| `POST /oauth/token` | Get OAuth token |
| `POST /oauth/ticket` | Get session ticket (called after login success) |

---

## 👤 User Profile

| Endpoint | Notes |
|----------|-------|
| `GET /user/v3/get` | Get user profile |
| `GET /user/find` | Find user |
| `POST /user/update` | Update profile |
| `POST /user/update/current/language` | Set language preference |
| `POST /user/checkNick` | Check nickname availability |
| `GET /user/batch` | Batch get user info |
| `GET /user/recently/list` | Recently viewed users |
| `GET /user/recently/search` | Recent searches |
| `POST /user/report/save` | Report a user |
| `POST /user/share/save` | Save share record |
| `GET /user/whitelist/info` | Check whitelist status |

---

## 📸 Photos

| Endpoint | Notes |
|----------|-------|
| `POST /photo/upload` | Upload photo |
| `POST /photo/v2/upload` | Upload photo v2 |
| `POST /photo/v3/upload` | Upload photo v3 |
| `POST /photo/delPhoto` | Delete photo |
| `POST /photo/replace` | Replace photo |
| `POST /photo/update/sort` | Update photo sort order |

---

## 👥 Social — Fans & Following

| Endpoint | Notes |
|----------|-------|
| `POST /fans/like` | Follow a user |
| `POST /fans/batchFollow` | Follow multiple users |
| `GET /fans/islike` | Check follow status |
| `GET /fans/fanslist` | Get fans list |
| `GET /fans/following` | Get following list |
| `GET /fans/friend` | Get friends list |
| `GET /fans/getCount` | Get fans/following count |

---

## 🚫 Blacklist

| Endpoint | Notes |
|----------|-------|
| `POST /user/blacklist/add` | Add to blacklist |
| `POST /user/blacklist/del` | Remove from blacklist |
| `GET /user/blacklist/list` | Get blacklist |

---

## 📱 SNS — Moments

| Endpoint | Notes |
|----------|-------|
| `POST /sns/moment/send` | Post a moment |
| `GET /sns/moment/get` | Get a moment |
| `GET /sns/moment/list` | Get moments list |
| `POST /sns/moment/del` | Delete moment |
| `POST /sns/moment/top` | Pin/top a moment |
| `GET /sns/moment/recommendMomentUserList` | Recommended users for moments |
| `GET /sns/moment/browse/history/list` | Moment view history |
| `POST /sns/moment/browse/history/clear` | Clear view history |
| `POST /sns/momentLike/like` | Like a moment |
| `POST /sns/momentLike/unlike` | Unlike a moment |
| `POST /sns/momentComment/comment` | Comment on moment |
| `POST /sns/momentComment/delete` | Delete comment |
| `POST /sns/momentComment/like` | Like a comment |
| `POST /sns/momentComment/unlike` | Unlike a comment |
| `GET /sns/momentComment/list` | Get comments list |
| `GET /sns/momentComment/selectHighlightList` | Highlighted comments |
| `GET /sns/momentMessage/newMsg` | New moment notifications |
| `GET /sns/momentMessage/list` | Moment messages list |
| `POST /sns/momentMessage/emptyMsg` | Clear moment messages |
| `GET /sns/momentTopic/list` | Topics list |
| `POST /sns/momentTopic/check` | Check topic |

---

## 🏠 Home & Discovery

| Endpoint | Notes |
|----------|-------|
| `GET /home/v10/index` | Home feed (main) |
| `GET /home/v10/mine` | My home tab |
| `GET /home/v1/list` | Home list (v1) |
| `GET /home/tab/room` | Home — rooms tab |
| `GET /home/get/continents` | Get continent list |
| `GET /explore/info` | Explore page info |
| `GET /search/room` | Search rooms |

---

## 🎙️ Live Room — Core

| Endpoint | Notes |
|----------|-------|
| `POST /room/initRoom` | Initialize/create a room |
| `POST /room/closeRoom` | Close a room |
| `POST /room/update` | Update room settings |
| `POST /room/updateByAdmin` | Admin update room |
| `GET /room/getAgoraKey` | Get Agora RTC key |
| `GET /room/getEndLiveInfo` | Get end-of-live stats |
| `GET /room/getPowerRoom` | Get power room info |
| `GET /room/getRecommendCard` | Get recommended room card |
| `GET /room/face/info` | Face info in room |
| `GET /room/compareFace` | Compare face |
| `POST /room/cleanRoomCharm` | Clear room charm stats |
| `GET /room/effects/get` | Get room effects |
| `POST /room/effects/set` | Set room effects |
| `GET /room/bg/list` | Room backgrounds list |
| `POST /room/bg/custom` | Set custom background |
| `POST /room/bg/wearRoomBg` | Wear background |
| `POST /room/bannedToPost` | Ban user from posting |
| `POST /room/kickIllegal` | Kick user (illegal) |
| `POST /room/kickIllegalAll` | Kick all (illegal) |
| `GET /room/mode/list` | Room modes list |
| `POST /room/mode/use` | Use a room mode |
| `POST /room/mode/buy/v1` | Buy room mode |
| `GET /room/mode/price/list` | Mode prices |
| `GET /room/mode/getMusicList` | Music list for room |
| `POST /room/mode/musicProcess` | Music process |
| `POST /room/mode/startPairing` | Start pairing mode |
| `POST /room/mode/stopPairing` | Stop pairing |
| `POST /room/mode/startRoomLottery` | Start lottery |

---

## 🎤 Mic Management

| Endpoint | Notes |
|----------|-------|
| `POST /room/mic/micUpApply` | Apply to go on mic |
| `POST /room/mic/micUpApplyClear` | Clear mic-up requests |
| `GET /room/mic/micUpApplyList` | List mic-up requests |
| `GET /room/mic/isMicUpApply` | Check if applied |
| `POST /room/mic/lockmic` | Lock a mic seat |
| `POST /room/mic/lockpos` | Lock mic position |
| `POST /room/mic/click/all/mic/position` | Click all mic positions |
| `POST /room/mic/v1/kickIllegal` | Kick from mic (illegal) |

---

## 🔗 Link Mic (Co-streaming)

| Endpoint | Notes |
|----------|-------|
| `POST /room/linkmic/apply` | Apply for linkmic |
| `POST /room/linkmic/apply/cancel` | Cancel linkmic request |
| `GET /room/linkmic/apply/list` | Pending linkmic requests |
| `POST /room/linkmic/agree` | Accept linkmic |
| `POST /room/linkmic/reject` | Reject linkmic |
| `POST /room/linkmic/kick` | Kick from linkmic |
| `POST /room/linkmic/leave` | Leave linkmic |
| `POST /room/linkmic/switch` | Switch linkmic mode |
| `POST /room/linkmic/zoom` | Zoom in linkmic |
| `GET /room/linkmic/current` | Current linkmic state |
| `POST /room/linkmic/invite` | Invite to linkmic |
| `GET /room/linkmic/invite/list` | Linkmic invite list |
| `POST /room/linkmic/invite/operate` | Operate invite |
| `POST /room/linkmic/media/control` | Media control |
| `POST /room/linkmic/user/leave/room/mark` | Mark user left room |

---

## ⚔️ PK Battle

| Endpoint | Notes |
|----------|-------|
| `POST /room/pk/matching` | Start PK matching |
| `POST /room/pk/cancelMatching` | Cancel PK matching |
| `POST /room/pk/invitePk` | Invite to PK |
| `POST /room/pk/agreePk` | Accept PK invite |
| `POST /room/pk/rejectPk` | Reject PK |
| `POST /room/pk/finish` | Finish PK |
| `POST /room/pk/surrender` | Surrender PK |
| `GET /room/pk/getInfo` | PK info |
| `GET /room/pk/log` | PK logs |
| `GET /room/pk/roomList` | PK room list |
| `GET /room/pk/invitationList` | PK invitation list |
| `GET /room/pk/getRuleInfo` | PK rules |
| `GET /room/pk/getPKRunningList` | Running PK list |
| `GET /room/pk/getIsInviteNewMsg` | New PK invite notification |
| `POST /room/pk/switchOpponentRoomSound` | Switch opponent audio |

---

## 💬 IM / Chat (IMSVR)

| Endpoint | Notes |
|----------|-------|
| `POST /imsvr/v1/sendText` | Send text message |
| `GET /imsvr/v1/fetchRoomMembers` | Fetch room members |
| `GET /imsvr/v1/v3/fetchRoomMembers` | Fetch room members v3 |
| `GET /imsvr/v1/getRoomMemberUidList` | Get member UID list |
| `GET /imsvr/v1/fetchRoomManagers` | Get room managers |
| `GET /imsvr/v1/fetchRoomBlackList` | Room blacklist |
| `POST /imsvr/v1/markChatRoomBlackList` | Add to room blacklist |
| `GET /imsvr/v1/fetchChatRoomMuteList` | Room mute list |
| `POST /imsvr/v1/markChatRoomMute` | Mute in room |
| `POST /imsvr/v1/markChatRoomManager` | Set room manager |
| `POST /imsvr/v1/kickMember` | Kick room member |

---

## 🎁 Gifts

| Endpoint | Notes |
|----------|-------|
| `GET /gift/listV3` | Gift list v3 |
| `GET /gift/listPackage` | Gift packages |
| `POST /gift/sendV10` | Send gift v10 |
| `POST /gift/sendWholeMicroV10` | Send whole-mic gift |
| `GET /gift/bar/actInlet` | Gift bar activity inlet |
| `GET /giftwall/get` | Gift wall info |
| `GET /giftwall/getUserHistoryReceives` | Gift wall receive history |
| `GET /giftCar/list` | Gift car list |
| `GET /giftCar/user/list` | User's gift cars |
| `GET /giftCar/purse` | Gift car wallet |
| `POST /giftCar/give` | Give a gift car |
| `POST /giftCar/use` | Use a gift car |
| `GET /giftCar/queryHistoryCarList` | Gift car history |

---

## 🛒 Mall / Shop

| Endpoint | Notes |
|----------|-------|
| `GET /mall/items` | Mall items |
| `GET /mall/prop/list` | Props list |
| `GET /mall/prop/listv2` | Props list v2 |
| `GET /mall/recommend` | Recommended items |
| `GET /mall/recommendv2` | Recommended items v2 |
| `GET /mall/purse` | User's mall wallet |
| `GET /chargeprod/list` | Charge products (top-up options) |

---

## 👑 Headwear & Titles

| Endpoint | Notes |
|----------|-------|
| `GET /headwear/list` | Headwear list |
| `GET /headwear/user/list` | User headwear |
| `GET /headwear/purse` | Headwear wallet |
| `POST /headwear/use` | Wear headwear |
| `POST /headwear/give` | Give headwear |
| `GET /headwear/queryHistoryHeadwearList` | Headwear history |
| `GET /title/getList` | Titles list |
| `POST /title/wear` | Wear a title |
| `GET /title/queryHistoryMedalList` | Medal history |

---

## 🪙 Wallet & Billing

| Endpoint | Notes |
|----------|-------|
| `GET /purse/query` | Query wallet balance |
| `GET /billrecord/v2/get` | Billing records v2 |
| `GET /billrecord/v3/get` | Billing records v3 |
| `GET /billrecord/getSweetScoreRecord` | Sweet score records |
| `POST /withDraw/exchangeGold` | Exchange gold (withdraw) |
| `GET /silvercoin/getMissionInfo` | Silver coin missions |
| `GET /silvercoin/getRecordInfo` | Silver coin records |
| `POST /silvercoin/receiveSilverCoin` | Receive silver coins |
| `POST /silvercoin/draw/exchangeCoin` | Exchange silver coins |
| `GET /award/email/unread` | Unread award emails |
| `POST /goods/awardEmail/receive` | Receive award email |

---

## 💳 Google Play Payments

| Endpoint | Notes |
|----------|-------|
| `POST /google/generate/order` | Generate Google Play order |
| `POST /google/check/order` | Verify Google Play order |
| `POST /google/manual/check` | Manual order check |

---

## 🎰 Lucky Bags & Draws

| Endpoint | Notes |
|----------|-------|
| `POST /room/lucky/bag/create` | Create lucky bag |
| `GET /room/lucky/bag/get` | Get lucky bag |
| `GET /room/lucky/bag/getConf` | Lucky bag config |
| `GET /room/lucky/bag/detail` | Lucky bag detail |
| `POST /room/lucky/bag/grab` | Grab lucky bag |
| `POST /purse/draw/v2/draw` | Purse draw |
| `GET /purse/draw/drawGiftList` | Draw gift list |
| `GET /purse/draw/record` | Draw records |
| `GET /purse/draw/ruleDescription` | Draw rules |
| `POST /eggs/draw` | Eggs draw |
| `GET /eggs/drawGiftList` | Eggs draw gift list |
| `GET /eggs/record` | Eggs records |
| `GET /eggs/ruleDescription` | Eggs rules |
| `GET /eggs/getRankList` | Eggs rank list |
| `POST /blind/box/list` | Blind box list |
| `POST /room/rocket/draw` | Rocket draw |
| `POST /room/rocket/reEnter` | Re-enter rocket |

---

## 🏆 Rankings & Leaderboards

| Endpoint | Notes |
|----------|-------|
| `GET /allrank/getRoomRank` | Room rankings |
| `GET /allrank/getGameRank` | Game rankings |
| `GET /allrank/getRankGameNewRecord` | New game records |
| `GET /allrank/geth5` | H5 rankings page |
| `GET /guild/rank/list` | Guild rank list |
| `GET /room/fans/club/getLastWeeklyFansClubRank` | Weekly fans club rank |
| `GET /roomctrb/guardian/rank` | Guardian rank |
| `GET /roomctrb/queryByType` | Room contribution by type |
| `GET /activity/room/level/getInfo` | Room level activity info |
| `GET /activity/room/level/getRoomMateList` | Room mate list |
| `POST /activity/room/level/setUpRoomMate` | Set up room mate |

---

## 🎮 Games (SUD)

| Endpoint | Notes |
|----------|-------|
| `GET /sud/game/list` | Game list |
| `POST /sud/game/create` | Create game |
| `POST /sud/game/start` | Start game |
| `POST /sud/game/end` | End game |
| `POST /sud/game/ready` | Mark ready |
| `POST /sud/game/participate` | Join game |
| `POST /sud/game/update` | Update game state |
| `POST /sud/game/user/in` | User in game |
| `POST /sud/game/kick/user` | Kick from game |
| `GET /sud/game/select/record/list` | Game select records |
| `GET /sud/game/select/total/record` | Total game records |
| `GET /ludo/game/select/room/record/list` | Ludo room records |
| `POST /ludo/game/select/skin/use` | Use Ludo skin |
| `GET /modularization/game/list` | Modular game list |
| `GET /client/game/all/config` | All game configs |

---

## 🎬 Movie / Watch Together

| Endpoint | Notes |
|----------|-------|
| `POST /room/movie/upload` | Upload movie |
| `GET /room/movie/list` | Movie list |
| `GET /room/movie/get/player/info` | Get player info |
| `POST /room/movie/process` | Movie playback process |
| `POST /room/movie/seek/to` | Seek to position |
| `POST /room/movie/delete` | Delete movie |
| `POST /room/movie/violation` | Report violation |

---

## 🤝 CP (Couple) System

| Endpoint | Notes |
|----------|-------|
| `GET /user/cp/rank` | CP rankings |
| `GET /user/cp/space` | CP space |
| `POST /user/cp/change/show` | Change CP display |
| `POST /user/cp/del` | Delete CP relationship |
| `POST /user/cp/handle` | Handle CP request |
| `GET /user/cp/selectCpList` | Available CP list |
| `POST /user/cp/task/receive` | Receive CP task reward |

---

## 💝 Match / Dating

| Endpoint | Notes |
|----------|-------|
| `POST /match/call` | Start match call |
| `POST /match/call/cancel` | Cancel match call |
| `POST /match/call/to` | Call to user |
| `POST /match/call/finish` | Finish call |
| `GET /match/call/info` | Call info |
| `GET /match/call/price/list` | Call prices |
| `POST /match/call/set/price` | Set call price |
| `GET /match/call/showInfo` | Call show info |
| `POST /match/chat` | Match chat |
| `POST /match/chat/cancel` | Cancel match chat |
| `POST /match/cleanBusy` | Clear busy status |
| `GET /agent/search/same/country/list` | Search nearby users |

---

## 🏛️ Guild System

| Endpoint | Notes |
|----------|-------|
| `POST /guild/getUpToken` | Get upload token |
| `GET /guild/live/wallet/personal` | Personal guild wallet |
| `GET /guild/live/wallet/bill` | Guild wallet bill |
| `POST /guild/live/wallet/merge` | Merge wallets |
| `POST /guild/live/withdrawal/create/order` | Create withdrawal order |
| `GET /guild/live/withdrawal/info` | Withdrawal info |
| `GET /guild/live/withdrawal/records/withdraw` | Withdrawal records |
| `GET /guild/live/withdrawal/records/exchange` | Exchange records |
| `GET /guild/live/withdrawal/records/transfer` | Transfer records |
| `GET /guild/live/withdrawal/president/transfer/records` | President transfer records |
| `POST /guild/live/withdrawal/president/accept/transfer` | Accept transfer |
| `POST /guild/live/withdrawal/president/reject/transfer` | Reject transfer |
| `POST /guild/live/withdrawal/user/confirm` | User confirm withdrawal |
| `POST /guild/live/withdrawal/user/not/receive` | User not received |
| `GET /guild/payment/channel/config/list` | Payment channel configs |
| `GET /guild/payment/channel/account/detail` | Payment account detail |
| `GET /guild/payment/channel/user/accounts` | User payment accounts |
| `POST /guild/payment/channel/account/save` | Save payment account |
| `POST /guild/payment/channel/account/del` | Delete payment account |
| `POST /guild/payment/channel/active` | Activate payment channel |
| `POST /householder/join` | Join as householder |

---

## ⚙️ Client Config

| Endpoint | Notes |
|----------|-------|
| `GET /client/init` | App initialization config |
| `GET /client/configure` | Client configuration |
| `GET /client/country` | Country list |
| `GET /client/emojiData` | Emoji data |
| `GET /client/faceInfo` | Face filter info |
| `GET /client/getResourceList` | Resource list |
| `GET /client/pop/up/list` | Popups config |
| `GET /client/my/banner` | My banners |
| `GET /client/wallet/banner` | Wallet banners |
| `GET /client/log/upload` | Log upload |
| `GET /client/clipboard/parse` | Parse clipboard content |
| `GET /version/getInfo` | App version info |
| `GET /sensitiveWord/list` | Sensitive words list |
| `POST /live/beauty/sticker/list` | Beauty stickers |
| `POST /live/event/report` | Report live event |

---

## 📣 Banners & Activities

| Endpoint | Notes |
|----------|-------|
| `GET /app/banner/conf` | Banner configuration |
| `GET /app/banner/act/list` | Activity banners list |
| `GET /app/banner/act/details` | Activity banner details |
| `POST /app/banner/act/establish` | Start activity |
| `POST /app/banner/act/subscription` | Subscribe to activity |
| `GET /allBanner/getFullBanner` | Full banners |
| `GET /allBanner/getMineBanner` | My banners |
| `GET /activity/invite/bind/code` | Bind invite code |
| `GET /activity/query` | Query activity |

---

## 😀 Emoji

| Endpoint | Notes |
|----------|-------|
| `GET /emoji/emojiData` | Emoji data |
| `POST /emoji/insert` | Add emoji |
| `POST /emoji/batchDelete` | Delete emojis |
| `POST /emoji/saveSort` | Save emoji sort |
| `GET /emoji/uploadRule` | Emoji upload rules |

---

## 🛡️ Room Permissions & Moderation

| Endpoint | Notes |
|----------|-------|
| `GET /room/opt/myPermission` | My room permissions |
| `GET /room/opt/adminList` | Admin list |
| `GET /room/opt/logList` | Permission logs |
| `POST /room/opt/setPermission` | Set permissions |
| `GET /live/get/black/list` | Live blacklist |
| `POST /live/add/black/list` | Add to live blacklist |
| `POST /live/remove/black/list` | Remove from live blacklist |
| `GET /live/get/black/cast/mark` | Black cast mark |
| `GET /live/get/last/data/record` | Last data record |

---

## 🔧 Admin (External)

| Endpoint | Notes |
|----------|-------|
| `POST /external/admin/block` | Block user |
| `POST /external/admin/unBlock` | Unblock user |
| `POST /external/admin/banRoom` | Ban room |
| `POST /external/admin/banSpeech` | Ban speech |
| `POST /external/admin/closeRoom` | Close room |
| `POST /external/admin/downMic` | Force off mic |
| `POST /external/admin/delPhoto` | Delete user photo |
| `POST /external/admin/deleteMoment` | Delete user moment |
| `POST /external/admin/resetInfo` | Reset user info |
| `POST /external/admin/checkZones` | Check zones |

---

## 💬 Feedback

| Endpoint | Notes |
|----------|-------|
| `POST /feedback/save` | Submit feedback |
| `GET /feedback/getList` | Get feedback list |

---

## 👤 User Props & Items

| Endpoint | Notes |
|----------|-------|
| `GET /user/prop/list` | Props list |
| `GET /user/prop/own` | Owned props |
| `POST /user/prop/wear` | Wear a prop |
| `GET /user/prop/queryHistoryList` | Props history |
| `GET /uservisitor/visitorRecord` | Visitor records |

---

## 📊 Summary

| Category | Count |
|----------|-------|
| Authentication | 24 |
| User & Profile | 12 |
| Social (Fans/SNS) | 28 |
| Live Room | 45 |
| Games | 14 |
| Gifts & Mall | 22 |
| Wallet & Billing | 12 |
| Guild System | 21 |
| Rankings | 10 |
| Admin/Moderation | 18 |
| Config/Client | 16 |
| Other | 15 |
| **Total** | **~237** |

