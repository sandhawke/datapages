
Simple distributed/synchronized database for use in webapps.  Client
apps instantiate a DB() which connects to the server and gives them a
read/write view of a shared set of "pages" (aka "documents" or
"objects" or "records").  Changes propogate quickly and persist.

Changes are tagged with who did them, currenly using webgram
SessionID.  We may want to use real user identity instead, but maybe
not, since we might want to distinguish between a change I made on my
tablet vs laptop vs incognito mode somewhere.  With SessionIDs we need
to do another level of mapping though, which could get annoying.

API style is inspired by
[crosscloud.js](https://github.com/sandhawke/crosscloud.js/blob/master/doc/planned-api.md)
