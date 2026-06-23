# نقاط نهاية API — تطبيق Ditto Live
**التطبيق:** com.ditto.mobile الإصدار 1.3.4.0  
**المصدر:** تفكيك APK (smali ← UriProvider.smali)

---

## الروابط الأساسية (Base URLs)

| الدور | الرابط |
|-------|--------|
| **API الرئيسي (إنتاج)** | `https://www.sayyouditto.com` |
| **CDN / الموارد** | `https://res.sayyouditto.com` |
| **سيرفر الألعاب** | `https://hule.games.sayyouditto.com` |
| **API التجريبي (Beta)** | `http://beta.ditto.wooyavip.com` |
| **موارد تجريبية** | `http://ditto.res.wooyavip.com` |

---

## 🔐 المصادقة والحساب

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /acc/third/login` | تسجيل الدخول الرئيسي (Google/Facebook/Apple) — يُرسل `turingToken` والجسم مشفّر بـ AES |
| `POST /acc/sms` | إرسال رمز التحقق عبر SMS |
| `GET /acc/sms/filter` | فحص فلتر SMS |
| `POST /acc/setPsw` | تعيين كلمة المرور |
| `POST /acc/pwd/reset` | إعادة تعيين كلمة المرور |
| `GET /acc/getBaseInfo` | جلب المعلومات الأساسية للحساب |
| `POST /acc/logout` | تسجيل الخروج |
| `POST /acc/cancelAccount` | حذف الحساب |
| `POST /acc/checkBindByPhone` | التحقق من ربط رقم الهاتف |
| `POST /acc/online` | نبضة الاتصال / حالة الاتصال |
| `POST /acc/setThird` | ربط حساب طرف ثالث |
| `POST /acc/security/v2/state` | حالة الأمان |
| `POST /acc/security/v2/phone/sendCode` | إرسال رمز التحقق للهاتف |
| `POST /acc/security/v2/phone/submit` | تأكيد التحقق من الهاتف |
| `POST /acc/security/v2/safe/sendCode` | إرسال رمز الأمان |
| `POST /acc/security/v2/safe/verify` | التحقق من رمز الأمان |
| `POST /acc/security/v2/third/bind` | ربط حساب طرف ثالث (v2) |
| `POST /acc/security/v2/third/unbind` | فك ربط حساب طرف ثالث |
| `POST /acc/security/v2/password/forgot/sendCode` | نسيت كلمة المرور — إرسال الرمز |
| `POST /acc/security/v2/password/forgot/verify` | نسيت كلمة المرور — التحقق من الرمز |
| `POST /acc/security/v2/password/forgot/submit` | نسيت كلمة المرور — تقديم الجديدة |
| `POST /acc/security/v2/password/reset` | إعادة تعيين كلمة المرور (v2) |

---

## 🛡️ كشف المخاطر (Turing Shield)

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /user/turingShield` | تهيئة نظام كشف المخاطر Turing — يُعيد صلاحية الـ turingToken |
| `GET /banned/checkBanned` | التحقق من حظر المستخدم أو الجهاز |

---

## 🎫 OAuth والتذاكر

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /oauth/token` | الحصول على رمز OAuth |
| `POST /oauth/ticket` | الحصول على تذكرة الجلسة (يُستدعى بعد نجاح تسجيل الدخول) |

---

## 👤 الملف الشخصي

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /user/v3/get` | جلب الملف الشخصي للمستخدم |
| `GET /user/find` | البحث عن مستخدم |
| `POST /user/update` | تحديث الملف الشخصي |
| `POST /user/update/current/language` | تعيين اللغة المفضّلة |
| `POST /user/checkNick` | التحقق من توفر اسم المستخدم |
| `GET /user/batch` | جلب بيانات مستخدمين متعددين دفعةً واحدة |
| `GET /user/recently/list` | المستخدمون المُزاروا مؤخراً |
| `GET /user/recently/search` | عمليات البحث الأخيرة |
| `POST /user/report/save` | الإبلاغ عن مستخدم |
| `POST /user/share/save` | حفظ سجل المشاركة |
| `GET /user/whitelist/info` | التحقق من وجود المستخدم في القائمة البيضاء |

---

## 📸 الصور

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /photo/upload` | رفع صورة |
| `POST /photo/v2/upload` | رفع صورة (v2) |
| `POST /photo/v3/upload` | رفع صورة (v3) |
| `POST /photo/delPhoto` | حذف صورة |
| `POST /photo/replace` | استبدال صورة |
| `POST /photo/update/sort` | تحديث ترتيب الصور |

---

## 👥 اجتماعي — المعجبون والمتابعون

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /fans/like` | متابعة مستخدم |
| `POST /fans/batchFollow` | متابعة عدة مستخدمين دفعةً |
| `GET /fans/islike` | التحقق من حالة المتابعة |
| `GET /fans/fanslist` | قائمة المعجبين |
| `GET /fans/following` | قائمة المتابَعين |
| `GET /fans/friend` | قائمة الأصدقاء |
| `GET /fans/getCount` | عدد المعجبين والمتابَعين |

---

## 🚫 القائمة السوداء

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /user/blacklist/add` | إضافة إلى القائمة السوداء |
| `POST /user/blacklist/del` | إزالة من القائمة السوداء |
| `GET /user/blacklist/list` | جلب القائمة السوداء |

---

## 📱 المنشورات (Moments)

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /sns/moment/send` | نشر منشور |
| `GET /sns/moment/get` | جلب منشور |
| `GET /sns/moment/list` | قائمة المنشورات |
| `POST /sns/moment/del` | حذف منشور |
| `POST /sns/moment/top` | تثبيت منشور |
| `GET /sns/moment/recommendMomentUserList` | مستخدمون مُقترحون للمنشورات |
| `GET /sns/moment/browse/history/list` | سجل مشاهدة المنشورات |
| `POST /sns/moment/browse/history/clear` | مسح سجل المشاهدة |
| `POST /sns/momentLike/like` | إعجاب بمنشور |
| `POST /sns/momentLike/unlike` | إلغاء الإعجاب بمنشور |
| `POST /sns/momentComment/comment` | التعليق على منشور |
| `POST /sns/momentComment/delete` | حذف تعليق |
| `POST /sns/momentComment/like` | إعجاب بتعليق |
| `POST /sns/momentComment/unlike` | إلغاء الإعجاب بتعليق |
| `GET /sns/momentComment/list` | قائمة التعليقات |
| `GET /sns/momentComment/selectHighlightList` | التعليقات المميزة |
| `GET /sns/momentMessage/newMsg` | إشعارات المنشورات الجديدة |
| `GET /sns/momentMessage/list` | قائمة رسائل المنشورات |
| `POST /sns/momentMessage/emptyMsg` | مسح رسائل المنشورات |
| `GET /sns/momentTopic/list` | قائمة المواضيع |
| `POST /sns/momentTopic/check` | التحقق من موضوع |

---

## 🏠 الرئيسية والاستكشاف

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /home/v10/index` | التغذية الرئيسية (الصفحة الرئيسية) |
| `GET /home/v10/mine` | تبويب "لي" في الرئيسية |
| `GET /home/v1/list` | قائمة الرئيسية (v1) |
| `GET /home/tab/room` | تبويب الغرف في الرئيسية |
| `GET /home/get/continents` | جلب قائمة القارات |
| `GET /explore/info` | معلومات صفحة الاستكشاف |
| `GET /search/room` | البحث عن غرف |

---

## 🎙️ الغرفة المباشرة — الأساسيات

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /room/initRoom` | إنشاء/تهيئة غرفة |
| `POST /room/closeRoom` | إغلاق غرفة |
| `POST /room/update` | تحديث إعدادات الغرفة |
| `POST /room/updateByAdmin` | تحديث الغرفة بصلاحيات المشرف |
| `GET /room/getAgoraKey` | جلب مفتاح Agora RTC |
| `GET /room/getEndLiveInfo` | إحصائيات نهاية البث |
| `GET /room/getPowerRoom` | جلب معلومات غرفة الطاقة |
| `GET /room/getRecommendCard` | جلب بطاقة الغرفة المُقترحة |
| `GET /room/face/info` | معلومات الوجه في الغرفة |
| `GET /room/compareFace` | مقارنة الوجه |
| `POST /room/cleanRoomCharm` | مسح إحصائيات سحر الغرفة |
| `GET /room/effects/get` | جلب تأثيرات الغرفة |
| `POST /room/effects/set` | تعيين تأثيرات الغرفة |
| `GET /room/bg/list` | قائمة خلفيات الغرفة |
| `POST /room/bg/custom` | تعيين خلفية مخصصة |
| `POST /room/bg/wearRoomBg` | ارتداء خلفية |
| `POST /room/bannedToPost` | حظر مستخدم من النشر |
| `POST /room/kickIllegal` | طرد مستخدم (مخالف) |
| `POST /room/kickIllegalAll` | طرد الجميع (مخالفون) |
| `GET /room/mode/list` | قائمة أوضاع الغرفة |
| `POST /room/mode/use` | استخدام وضع غرفة |
| `POST /room/mode/buy/v1` | شراء وضع غرفة |
| `GET /room/mode/price/list` | أسعار الأوضاع |
| `GET /room/mode/getMusicList` | قائمة الموسيقى في الغرفة |
| `POST /room/mode/musicProcess` | معالجة الموسيقى |
| `POST /room/mode/startPairing` | بدء وضع الإقران |
| `POST /room/mode/stopPairing` | إيقاف الإقران |
| `POST /room/mode/startRoomLottery` | بدء السحب في الغرفة |

---

## 🎤 إدارة الميكروفون

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /room/mic/micUpApply` | التقديم للصعود على الميكروفون |
| `POST /room/mic/micUpApplyClear` | مسح طلبات الميكروفون |
| `GET /room/mic/micUpApplyList` | قائمة طلبات الميكروفون |
| `GET /room/mic/isMicUpApply` | التحقق من وجود طلب |
| `POST /room/mic/lockmic` | قفل مقعد الميكروفون |
| `POST /room/mic/lockpos` | قفل موضع الميكروفون |
| `POST /room/mic/click/all/mic/position` | الضغط على جميع مواضع الميكروفون |
| `POST /room/mic/v1/kickIllegal` | طرد من الميكروفون (مخالف) |

---

## 🔗 Link Mic (البث المشترك)

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /room/linkmic/apply` | التقديم للبث المشترك |
| `POST /room/linkmic/apply/cancel` | إلغاء طلب البث المشترك |
| `GET /room/linkmic/apply/list` | طلبات البث المشترك المعلقة |
| `POST /room/linkmic/agree` | قبول البث المشترك |
| `POST /room/linkmic/reject` | رفض البث المشترك |
| `POST /room/linkmic/kick` | طرد من البث المشترك |
| `POST /room/linkmic/leave` | مغادرة البث المشترك |
| `POST /room/linkmic/switch` | تبديل وضع البث المشترك |
| `POST /room/linkmic/zoom` | تكبير في البث المشترك |
| `GET /room/linkmic/current` | الحالة الحالية للبث المشترك |
| `POST /room/linkmic/invite` | دعوة للبث المشترك |
| `GET /room/linkmic/invite/list` | قائمة دعوات البث المشترك |
| `POST /room/linkmic/invite/operate` | التعامل مع الدعوة |
| `POST /room/linkmic/media/control` | التحكم في الوسائط |
| `POST /room/linkmic/user/leave/room/mark` | تسجيل مغادرة المستخدم للغرفة |

---

## ⚔️ معارك PK

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /room/pk/matching` | بدء مطابقة PK |
| `POST /room/pk/cancelMatching` | إلغاء مطابقة PK |
| `POST /room/pk/invitePk` | دعوة لمعركة PK |
| `POST /room/pk/agreePk` | قبول دعوة PK |
| `POST /room/pk/rejectPk` | رفض دعوة PK |
| `POST /room/pk/finish` | إنهاء معركة PK |
| `POST /room/pk/surrender` | الاستسلام في PK |
| `GET /room/pk/getInfo` | معلومات PK |
| `GET /room/pk/log` | سجلات PK |
| `GET /room/pk/roomList` | قائمة غرف PK |
| `GET /room/pk/invitationList` | قائمة دعوات PK |
| `GET /room/pk/getRuleInfo` | قواعد PK |
| `GET /room/pk/getPKRunningList` | قائمة معارك PK الجارية |
| `GET /room/pk/getIsInviteNewMsg` | إشعار دعوة PK جديدة |
| `POST /room/pk/switchOpponentRoomSound` | تبديل صوت غرفة الخصم |

---

## 💬 المحادثات والرسائل (IMSVR)

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /imsvr/v1/sendText` | إرسال رسالة نصية |
| `GET /imsvr/v1/fetchRoomMembers` | جلب أعضاء الغرفة |
| `GET /imsvr/v1/v3/fetchRoomMembers` | جلب أعضاء الغرفة (v3) |
| `GET /imsvr/v1/getRoomMemberUidList` | جلب قائمة معرّفات الأعضاء |
| `GET /imsvr/v1/fetchRoomManagers` | جلب مشرفي الغرفة |
| `GET /imsvr/v1/fetchRoomBlackList` | القائمة السوداء للغرفة |
| `POST /imsvr/v1/markChatRoomBlackList` | إضافة للقائمة السوداء في الغرفة |
| `GET /imsvr/v1/fetchChatRoomMuteList` | قائمة كتم الصوت في الغرفة |
| `POST /imsvr/v1/markChatRoomMute` | كتم مستخدم في الغرفة |
| `POST /imsvr/v1/markChatRoomManager` | تعيين مشرف الغرفة |
| `POST /imsvr/v1/kickMember` | طرد عضو من الغرفة |

---

## 🎁 الهدايا

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /gift/listV3` | قائمة الهدايا (v3) |
| `GET /gift/listPackage` | حزم الهدايا |
| `POST /gift/sendV10` | إرسال هدية (v10) |
| `POST /gift/sendWholeMicroV10` | إرسال هدية للميكروفون كاملاً |
| `GET /gift/bar/actInlet` | مدخل نشاط شريط الهدايا |
| `GET /giftwall/get` | معلومات جدار الهدايا |
| `GET /giftwall/getUserHistoryReceives` | سجل استقبال هدايا الجدار |
| `GET /giftCar/list` | قائمة سيارات الهدايا |
| `GET /giftCar/user/list` | سيارات هدايا المستخدم |
| `GET /giftCar/purse` | محفظة سيارات الهدايا |
| `POST /giftCar/give` | إهداء سيارة هدايا |
| `POST /giftCar/use` | استخدام سيارة هدايا |
| `GET /giftCar/queryHistoryCarList` | سجل سيارات الهدايا |

---

## 🛒 المتجر

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /mall/items` | عناصر المتجر |
| `GET /mall/prop/list` | قائمة الأدوات |
| `GET /mall/prop/listv2` | قائمة الأدوات (v2) |
| `GET /mall/recommend` | العناصر المُقترحة |
| `GET /mall/recommendv2` | العناصر المُقترحة (v2) |
| `GET /mall/purse` | محفظة المستخدم في المتجر |
| `GET /chargeprod/list` | منتجات الشحن (خيارات الدفع) |

---

## 👑 الأغطية والألقاب

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /headwear/list` | قائمة الأغطية |
| `GET /headwear/user/list` | أغطية المستخدم |
| `GET /headwear/purse` | محفظة الأغطية |
| `POST /headwear/use` | ارتداء غطاء |
| `POST /headwear/give` | إهداء غطاء |
| `GET /headwear/queryHistoryHeadwearList` | سجل الأغطية |
| `GET /title/getList` | قائمة الألقاب |
| `POST /title/wear` | ارتداء لقب |
| `GET /title/queryHistoryMedalList` | سجل الأوسمة |

---

## 🪙 المحفظة والفواتير

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /purse/query` | الاستعلام عن رصيد المحفظة |
| `GET /billrecord/v2/get` | سجلات الفواتير (v2) |
| `GET /billrecord/v3/get` | سجلات الفواتير (v3) |
| `GET /billrecord/getSweetScoreRecord` | سجلات النقاط الحلوة |
| `POST /withDraw/exchangeGold` | استبدال بالذهب (سحب) |
| `GET /silvercoin/getMissionInfo` | مهام العملة الفضية |
| `GET /silvercoin/getRecordInfo` | سجلات العملة الفضية |
| `POST /silvercoin/receiveSilverCoin` | استلام عملات فضية |
| `POST /silvercoin/draw/exchangeCoin` | استبدال العملات الفضية |
| `GET /award/email/unread` | رسائل جوائز غير مقروءة |
| `POST /goods/awardEmail/receive` | استلام رسالة جائزة |

---

## 💳 مدفوعات Google Play

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /google/generate/order` | إنشاء طلب شراء Google Play |
| `POST /google/check/order` | التحقق من طلب Google Play |
| `POST /google/manual/check` | فحص يدوي للطلب |

---

## 🎰 الحقائب المحظوظة والسحوبات

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /room/lucky/bag/create` | إنشاء حقيبة محظوظة |
| `GET /room/lucky/bag/get` | جلب الحقيبة المحظوظة |
| `GET /room/lucky/bag/getConf` | إعدادات الحقيبة المحظوظة |
| `GET /room/lucky/bag/detail` | تفاصيل الحقيبة المحظوظة |
| `POST /room/lucky/bag/grab` | الإمساك بالحقيبة المحظوظة |
| `POST /purse/draw/v2/draw` | سحب من المحفظة |
| `GET /purse/draw/drawGiftList` | قائمة جوائز السحب |
| `GET /purse/draw/record` | سجلات السحب |
| `GET /purse/draw/ruleDescription` | قواعد السحب |
| `POST /eggs/draw` | سحب البيض |
| `GET /eggs/drawGiftList` | قائمة جوائز سحب البيض |
| `GET /eggs/record` | سجلات البيض |
| `GET /eggs/ruleDescription` | قواعد البيض |
| `GET /eggs/getRankList` | تصنيف البيض |
| `POST /blind/box/list` | قائمة الصندوق الغامض |
| `POST /room/rocket/draw` | سحب الصاروخ |
| `POST /room/rocket/reEnter` | إعادة الدخول للصاروخ |

---

## 🏆 التصنيفات وقوائم المتصدرين

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /allrank/getRoomRank` | تصنيف الغرف |
| `GET /allrank/getGameRank` | تصنيف الألعاب |
| `GET /allrank/getRankGameNewRecord` | أحدث سجلات الألعاب |
| `GET /allrank/geth5` | صفحة التصنيفات H5 |
| `GET /guild/rank/list` | تصنيف الجيلد |
| `GET /room/fans/club/getLastWeeklyFansClubRank` | تصنيف نادي المعجبين الأسبوعي |
| `GET /roomctrb/guardian/rank` | تصنيف الحرّاس |
| `GET /roomctrb/queryByType` | مساهمات الغرفة حسب النوع |
| `GET /activity/room/level/getInfo` | معلومات نشاط مستوى الغرفة |
| `GET /activity/room/level/getRoomMateList` | قائمة رفاق الغرفة |
| `POST /activity/room/level/setUpRoomMate` | تعيين رفاق الغرفة |

---

## 🎮 الألعاب (SUD)

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /sud/game/list` | قائمة الألعاب |
| `POST /sud/game/create` | إنشاء لعبة |
| `POST /sud/game/start` | بدء اللعبة |
| `POST /sud/game/end` | إنهاء اللعبة |
| `POST /sud/game/ready` | الاستعداد |
| `POST /sud/game/participate` | الانضمام للعبة |
| `POST /sud/game/update` | تحديث حالة اللعبة |
| `POST /sud/game/user/in` | المستخدم في اللعبة |
| `POST /sud/game/kick/user` | طرد من اللعبة |
| `GET /sud/game/select/record/list` | سجلات اختيار اللعبة |
| `GET /sud/game/select/total/record` | إجمالي سجلات الألعاب |
| `GET /ludo/game/select/room/record/list` | سجلات غرفة لعبة Ludo |
| `POST /ludo/game/select/skin/use` | استخدام سكن Ludo |
| `GET /modularization/game/list` | قائمة الألعاب المعيارية |
| `GET /client/game/all/config` | إعدادات جميع الألعاب |

---

## 🎬 مشاهدة الأفلام معاً

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /room/movie/upload` | رفع فيلم |
| `GET /room/movie/list` | قائمة الأفلام |
| `GET /room/movie/get/player/info` | معلومات المشغّل |
| `POST /room/movie/process` | معالجة تشغيل الفيلم |
| `POST /room/movie/seek/to` | الانتقال لموضع معين |
| `POST /room/movie/delete` | حذف فيلم |
| `POST /room/movie/violation` | الإبلاغ عن مخالفة |

---

## 🤝 نظام CP (الأزواج)

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /user/cp/rank` | تصنيف الأزواج |
| `GET /user/cp/space` | فضاء الزوجين |
| `POST /user/cp/change/show` | تغيير عرض الزوج |
| `POST /user/cp/del` | إلغاء علاقة الزوجين |
| `POST /user/cp/handle` | التعامل مع طلب زوج |
| `GET /user/cp/selectCpList` | قائمة الأزواج المتاحين |
| `POST /user/cp/task/receive` | استلام مكافأة مهمة الزوجين |

---

## 💝 المطابقة والتعارف

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /match/call` | بدء مكالمة مطابقة |
| `POST /match/call/cancel` | إلغاء مكالمة المطابقة |
| `POST /match/call/to` | الاتصال بمستخدم |
| `POST /match/call/finish` | إنهاء المكالمة |
| `GET /match/call/info` | معلومات المكالمة |
| `GET /match/call/price/list` | أسعار المكالمات |
| `POST /match/call/set/price` | تعيين سعر المكالمة |
| `GET /match/call/showInfo` | عرض معلومات المكالمة |
| `POST /match/chat` | محادثة مطابقة |
| `POST /match/chat/cancel` | إلغاء محادثة المطابقة |
| `POST /match/cleanBusy` | مسح حالة الانشغال |
| `GET /agent/search/same/country/list` | البحث عن مستخدمين قريبين |

---

## 🏛️ نظام الجيلد (Guild)

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /guild/getUpToken` | جلب رمز الرفع |
| `GET /guild/live/wallet/personal` | المحفظة الشخصية للجيلد |
| `GET /guild/live/wallet/bill` | فاتورة محفظة الجيلد |
| `POST /guild/live/wallet/merge` | دمج المحافظ |
| `POST /guild/live/withdrawal/create/order` | إنشاء طلب سحب |
| `GET /guild/live/withdrawal/info` | معلومات السحب |
| `GET /guild/live/withdrawal/records/withdraw` | سجلات السحب |
| `GET /guild/live/withdrawal/records/exchange` | سجلات الاستبدال |
| `GET /guild/live/withdrawal/records/transfer` | سجلات التحويل |
| `GET /guild/live/withdrawal/president/transfer/records` | سجلات تحويلات الرئيس |
| `POST /guild/live/withdrawal/president/accept/transfer` | قبول التحويل |
| `POST /guild/live/withdrawal/president/reject/transfer` | رفض التحويل |
| `POST /guild/live/withdrawal/user/confirm` | تأكيد السحب من المستخدم |
| `POST /guild/live/withdrawal/user/not/receive` | المستخدم لم يستلم |
| `GET /guild/payment/channel/config/list` | إعدادات قنوات الدفع |
| `GET /guild/payment/channel/account/detail` | تفاصيل حساب الدفع |
| `GET /guild/payment/channel/user/accounts` | حسابات دفع المستخدم |
| `POST /guild/payment/channel/account/save` | حفظ حساب دفع |
| `POST /guild/payment/channel/account/del` | حذف حساب دفع |
| `POST /guild/payment/channel/active` | تفعيل قناة الدفع |
| `POST /householder/join` | الانضمام كرب بيت |

---

## ⚙️ إعدادات التطبيق

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /client/init` | إعدادات تهيئة التطبيق |
| `GET /client/configure` | إعدادات العميل |
| `GET /client/country` | قائمة الدول |
| `GET /client/emojiData` | بيانات الإيموجي |
| `GET /client/faceInfo` | معلومات فلتر الوجه |
| `GET /client/getResourceList` | قائمة الموارد |
| `GET /client/pop/up/list` | إعدادات النوافذ المنبثقة |
| `GET /client/my/banner` | لافتاتي |
| `GET /client/wallet/banner` | لافتات المحفظة |
| `GET /client/log/upload` | رفع السجلات |
| `GET /client/clipboard/parse` | تحليل محتوى الحافظة |
| `GET /version/getInfo` | معلومات إصدار التطبيق |
| `GET /sensitiveWord/list` | قائمة الكلمات الحساسة |
| `POST /live/beauty/sticker/list` | ملصقات التجميل |
| `POST /live/event/report` | الإبلاغ عن حدث مباشر |

---

## 📣 اللافتات والأنشطة

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /app/banner/conf` | إعدادات اللافتة |
| `GET /app/banner/act/list` | قائمة لافتات الأنشطة |
| `GET /app/banner/act/details` | تفاصيل لافتة النشاط |
| `POST /app/banner/act/establish` | بدء نشاط |
| `POST /app/banner/act/subscription` | الاشتراك في نشاط |
| `GET /allBanner/getFullBanner` | جميع اللافتات |
| `GET /allBanner/getMineBanner` | لافتاتي |
| `GET /activity/invite/bind/code` | ربط رمز الدعوة |
| `GET /activity/query` | الاستعلام عن نشاط |

---

## 😀 الإيموجي

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /emoji/emojiData` | بيانات الإيموجي |
| `POST /emoji/insert` | إضافة إيموجي |
| `POST /emoji/batchDelete` | حذف إيموجيات |
| `POST /emoji/saveSort` | حفظ ترتيب الإيموجي |
| `GET /emoji/uploadRule` | قواعد رفع الإيموجي |

---

## 🛡️ صلاحيات الغرفة والإشراف

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /room/opt/myPermission` | صلاحياتي في الغرفة |
| `GET /room/opt/adminList` | قائمة المشرفين |
| `GET /room/opt/logList` | سجلات الصلاحيات |
| `POST /room/opt/setPermission` | تعيين الصلاحيات |
| `GET /live/get/black/list` | القائمة السوداء للبث المباشر |
| `POST /live/add/black/list` | إضافة للقائمة السوداء |
| `POST /live/remove/black/list` | إزالة من القائمة السوداء |
| `GET /live/get/black/cast/mark` | علامة الممثل الأسود |
| `GET /live/get/last/data/record` | آخر سجل بيانات |

---

## 🔧 الإدارة الخارجية (Admin)

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /external/admin/block` | حظر مستخدم |
| `POST /external/admin/unBlock` | فك حظر مستخدم |
| `POST /external/admin/banRoom` | حظر غرفة |
| `POST /external/admin/banSpeech` | حظر الكلام |
| `POST /external/admin/closeRoom` | إغلاق غرفة |
| `POST /external/admin/downMic` | إجبار على النزول من الميكروفون |
| `POST /external/admin/delPhoto` | حذف صورة مستخدم |
| `POST /external/admin/deleteMoment` | حذف منشور مستخدم |
| `POST /external/admin/resetInfo` | إعادة تعيين معلومات مستخدم |
| `POST /external/admin/checkZones` | فحص المناطق |

---

## 💬 ردود الفعل والتقارير

| نقطة النهاية | الوصف |
|--------------|-------|
| `POST /feedback/save` | تقديم ملاحظات |
| `GET /feedback/getList` | جلب قائمة الملاحظات |

---

## 🎒 أدوات المستخدم والعناصر

| نقطة النهاية | الوصف |
|--------------|-------|
| `GET /user/prop/list` | قائمة الأدوات |
| `GET /user/prop/own` | الأدوات المملوكة |
| `POST /user/prop/wear` | ارتداء أداة |
| `GET /user/prop/queryHistoryList` | سجل الأدوات |
| `GET /uservisitor/visitorRecord` | سجلات الزوّار |

---

## 📊 ملخص

| الفئة | العدد |
|-------|-------|
| المصادقة والحساب | 24 |
| الملف الشخصي | 12 |
| اجتماعي (معجبون / منشورات) | 28 |
| الغرفة المباشرة | 45 |
| الألعاب | 14 |
| الهدايا والمتجر | 22 |
| المحفظة والفواتير | 12 |
| نظام الجيلد | 21 |
| التصنيفات | 10 |
| الإشراف والإدارة | 18 |
| إعدادات التطبيق | 16 |
| أخرى | 15 |
| **الإجمالي** | **~237** |
