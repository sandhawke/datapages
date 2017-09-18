
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

## Basic Operation

* Set up your objects the way you want, linked to each other, or
whatever, and the ones you want exposed to the outside world, you call
db.add() on them.

* After you've added them, if you want to change one of them, you can
either ask the system to make the change, using db.overlay, or you can
make the change yourself and call db.flush.  Someday we might use
Proxy to auto-flush, but then we'd have to create all the page objects
for you.  That would make nested objects/graphs more of a pain.

