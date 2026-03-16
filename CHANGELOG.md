# Changelog

## [1.2.0](https://github.com/hackutd/harp/compare/v1.1.1...v1.2.0) (2026-02-25)


### Features

* add prettier for consistent frontend code formatting ([59fc483](https://github.com/hackutd/harp/commit/59fc4838cc2b2d2c359280122042d1a46c61aa90))
* add prettier for consistent frontend code formatting ([31ec718](https://github.com/hackutd/harp/commit/31ec71842c0f25f455ce039f629806643e573212))
* **api:** add scan handlers, tests, and fix route prefixes ([b221351](https://github.com/hackutd/harp/commit/b2213511e888320040ffcb636f48760fdd825b91))
* **client:** update review assignment toast with instructions ([00ece7e](https://github.com/hackutd/harp/commit/00ece7ef0a108e5de31abb9e7902035268a3c726))
* create application toggle button in SuperAdmin settings panel [#10](https://github.com/hackutd/harp/issues/10) ([89f5327](https://github.com/hackutd/harp/commit/89f53279d035067aab4ee7f6595614a37f39f5b3))
* **db:** add scans table and scan type settings migrations ([77310f1](https://github.com/hackutd/harp/commit/77310f1495944caa127127b2871eeb5c63c289c9))
* o(1) scan stats, for future FE polling ([7ef5444](https://github.com/hackutd/harp/commit/7ef5444090f41c21d5c3958515928ec1d0b65c66))
* **settings:** implement review_assignments toggle ([7efc2af](https://github.com/hackutd/harp/commit/7efc2af9731f45979bb64b6a4253aa55e4defd7c))
* **store:** add scans store, types, and settings methods ([ca65af8](https://github.com/hackutd/harp/commit/ca65af8aec28c16c7a27aaecb581e8e485f989e0))


### Bug Fixes

* add updateReviewPage hook to automatically reload page on clicking ([84aaa6e](https://github.com/hackutd/harp/commit/84aaa6e2fa41bdb738da61daf54b7839e5e812ad))
* add updateReviewPage hook to automatically reload page on clicking ([7bfe827](https://github.com/hackutd/harp/commit/7bfe8274358ede61d879d05b12758fe413c350c3))
* bug with removing already completed review & some race conditions ([4f404de](https://github.com/hackutd/harp/commit/4f404de589963b8dc3aaf7b091051919bae3baa5))
* eslint error. closes [#10](https://github.com/hackutd/harp/issues/10) ([5c2896f](https://github.com/hackutd/harp/commit/5c2896f6a02d37103ce853ea2562fec6c6551497))
* **store:** backfill review assignment settings for admins ([74728a8](https://github.com/hackutd/harp/commit/74728a8499329ca4b68a6a19d07dac706d63aa91))
* **store:** make user creation and settings update atomic ([a783e67](https://github.com/hackutd/harp/commit/a783e67210b092c3e89062b91b780b8a4b63df03))
* **store:** persist disabled state for unknown admin IDs ([e58674f](https://github.com/hackutd/harp/commit/e58674fbfa4799b4b0d7454b40ed22b5c5d2db91))

## [1.1.1](https://github.com/hackutd/harp/compare/v1.1.0...v1.1.1) (2026-02-13)


### Bug Fixes

* update changelog grep to match release-please bracket format ([f91795c](https://github.com/hackutd/harp/commit/f91795c15f8be54623bfabb0ed46169d568e745b))

## [1.1.0](https://github.com/hackutd/harp/compare/v1.0.0...v1.1.0) (2026-02-13)


### Features

* update api version automatically ([60cc395](https://github.com/hackutd/harp/commit/60cc395060a93cd7d9595d4aace28140c4912d11))


### Bug Fixes

* auto udpating sem. version for api ([4002c0b](https://github.com/hackutd/harp/commit/4002c0bc6a89834e59fdfafc5789ea2ac544a514))
* testing auto updating semver HOPE THIS WORKS ([34892fc](https://github.com/hackutd/harp/commit/34892fcfa02bbba2887dd842fa2edae838e39230))

## 1.0.0 (2026-02-13)


### Features

* add application stats to the all applicants page ([3b879fe](https://github.com/hackutd/harp/commit/3b879fe7748d55fe54125592ca030b8cfb14c408))
* Add applications stats and applicant specific cards ([38a50ed](https://github.com/hackutd/harp/commit/38a50ed92025731f1056e7299c3ad47f7a4b59dd))
* add automation workflow ([7ea95a5](https://github.com/hackutd/harp/commit/7ea95a5285da795c2775ffbcd22be22067405f1a))
* add completed view + endpoints ([fbf75ec](https://github.com/hackutd/harp/commit/fbf75eca47106e33dba35e7a24f95019fbe4f194))
* add conventional commits githook ([4970559](https://github.com/hackutd/harp/commit/4970559aa71470a437ea40c8496a2570622b59fb))
* add databse seeding func. ([38b809f](https://github.com/hackutd/harp/commit/38b809f893584e54172eadeea83f8ad64514b0ad))
* add GET endpoints for pending reviews and reviews by application ([c47694e](https://github.com/hackutd/harp/commit/c47694e21ffc1f5dc5569430bd7370bd3ac2a2f1))
* add SPA handler ([fc1fd35](https://github.com/hackutd/harp/commit/fc1fd35e9884a33fc1e5bc98bd8424ca6b4abe4e))
* applications store with getOrCreateApplicationHanlder ([3bef31b](https://github.com/hackutd/harp/commit/3bef31b27e746209be6718a55af8fc53af577418))
* BE implement batch assign reviews and next review endpoints ([480fa06](https://github.com/hackutd/harp/commit/480fa06ea287933d19c596b2a1dd128dae020c69))
* consolidate env ([4cdb4fd](https://github.com/hackutd/harp/commit/4cdb4fdced4f1b9a00d966ad467c9d288ea98ead))
* consume hacker application endpoints for creating + editing + submitting. Implementation is not that nice it was vibecoded will likely need to refactor a lot of FE. ([e326962](https://github.com/hackutd/harp/commit/e326962002604d1dd2553c0b276d6c322d97fe51))
* convenience changes ([7fba065](https://github.com/hackutd/harp/commit/7fba06554d6bc0a6df2a8b8b1d261abd6f1d768a))
* cursor pagination for admin view of all applciations ([e8db610](https://github.com/hackutd/harp/commit/e8db6104fe62dda435d8d9ac11c74768a040cb8c))
* dockerfile ([ad8fdba](https://github.com/hackutd/harp/commit/ad8fdba73bda1d45a7e70ef0ca40be00716a14a6))
* expanded view for grading applications, added shortcuts for easy navigation. there is a BUG with accepting with shortcuts and saving the notes ([087291f](https://github.com/hackutd/harp/commit/087291f787435dd8b24fc68207b8e17ccc61a351))
* FE implementation of assigning review for admin ([237c7f2](https://github.com/hackutd/harp/commit/237c7f2e2c11b5f870f5769caebfe685a2c6d357))
* implement get application on admin side to view specific applications. ([434010e](https://github.com/hackutd/harp/commit/434010ebf846d4a45eeeaed1202bec8e6862a5bc))
* implement lazy loading pages ([76ea9de](https://github.com/hackutd/harp/commit/76ea9de234152dfebea75860452798acad453ab1))
* implement query applicant emails by status (ref [#6](https://github.com/hackutd/harp/issues/6)) tests not finished ([abc7ed4](https://github.com/hackutd/harp/commit/abc7ed4baae8b06c213714bc19d5a6f36ffe70a7))
* implement super admin set applciation status endpoint ([e2c98b1](https://github.com/hackutd/harp/commit/e2c98b1fefd52acc19a8ee34bb58492d1e7d916a))
* migrate lots of needed tables and implement get and set for reviews per application ([3d80721](https://github.com/hackutd/harp/commit/3d8072119d97e019a5cf9baf02b25ff9405aeb07))
* notes + review casting votes ([6f5ac39](https://github.com/hackutd/harp/commit/6f5ac39d5f27489b3f3acd44ace7deb0f287f317))
* query to grab applicant emails by status ([4f53342](https://github.com/hackutd/harp/commit/4f533427b2382a30b9a2c679cb5bc97023b9d872))
* release please script ([6a02b08](https://github.com/hackutd/harp/commit/6a02b083c9d9b840bbf112ef7a16a5747bf6805f))
* release please script ([d0d07d3](https://github.com/hackutd/harp/commit/d0d07d3cffd8d2c061b4d5a95cea79418879bfe9))
* submit applications handler + add additional fields for applciations ([b80f47a](https://github.com/hackutd/harp/commit/b80f47a8411625c1aecc61e9e038ef753f79e110))
* superadmin settings dialog UI ([7a5800f](https://github.com/hackutd/harp/commit/7a5800f4e290ca800e0f7c9234b191e1adbab8e4))
* UI for setting short answer questions ([4454738](https://github.com/hackutd/harp/commit/4454738d6491a48dcdccc6042d4b670169f01663))
* update/patch applications ([c91c4e4](https://github.com/hackutd/harp/commit/c91c4e4d6587ebfb79de6894a10febfa5c238edb))


### Bug Fixes

* /auth routing causing issues with super tokens and oauth ([6a1213f](https://github.com/hackutd/harp/commit/6a1213f5eec146dd374438337927cd34815dcc5b))
* abort stale requests and recycle db connections to prevent 500s ([0ef08e7](https://github.com/hackutd/harp/commit/0ef08e72c0eafbba5e9d237e1d9458d3001e8bcb))
* add main func for build testing CI ([0ec6c50](https://github.com/hackutd/harp/commit/0ec6c50996d6b3b5cefff782ff19278ea266c66b))
* add return, remove redundant if, add swagger docs. resolves [#6](https://github.com/hackutd/harp/issues/6) ([5423da5](https://github.com/hackutd/harp/commit/5423da5a59c0de8e4c988adfe48df5c2244bd66b))
* automations versioning ([641935b](https://github.com/hackutd/harp/commit/641935b44fb480b6bc2dc74171c27fde6b756ebe))
* change from path query to url query. test. closes [#6](https://github.com/hackutd/harp/issues/6) ([478ff16](https://github.com/hackutd/harp/commit/478ff16d8a91dc2a700f83f9d4be2cf175ecc100))
* empty string placeholder in DB by adding validation tags ([a464b61](https://github.com/hackutd/harp/commit/a464b612e683128a4d6a5d0b47f20ee7bbc22bfa))
* lint issues ([11487f8](https://github.com/hackutd/harp/commit/11487f807117076c51c0e15a57f910bffe075bc9))
* logging config for GCP ([3e58b17](https://github.com/hackutd/harp/commit/3e58b17694d2677de25d9544b177ef0f0ff295d9))
* remove unused exp field from mailConfig ([d45fe1d](https://github.com/hackutd/harp/commit/d45fe1d0dd590f166fb683f08105e4408ec6c656))
* remove unused tokenConfig type and token field ([2dc16e0](https://github.com/hackutd/harp/commit/2dc16e05d45056803b33eaa5cfac63afa1b6def3))
* reroute /admin to /admin/applications ([63f1472](https://github.com/hackutd/harp/commit/63f1472388d22242841a08b9c1c0a1e7d23ee415))
* route auth and review endpoints through centralized API client ([9ee5db1](https://github.com/hackutd/harp/commit/9ee5db16c6739a4d02f136b5a5595da318361b63))
* routing for /auth supertokens config for swagger ([337ed04](https://github.com/hackutd/harp/commit/337ed046c7856e844beee5e1d55c44dd8f2a842a))
* switch to pgx driver for Neon DB compatibility ([4afdfe0](https://github.com/hackutd/harp/commit/4afdfe0f417a5d1d33f0f15f29f569b36646f63f))
* use direct type conversion instead of struct literals ([7cb887e](https://github.com/hackutd/harp/commit/7cb887e560990635e6513612a0fb06df3b36217e))
