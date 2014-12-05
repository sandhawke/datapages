
// THESE ARE JUST THOUGHTS, NOT IMPLEMENTED AT ALL...

// A PageStore is a database that looks a lot like a set of Web Sites and
// also a JSON document store (like MongoDB).

db := NewDB()

// SetSiteURLTemplate allows a pageId (URL) to be mapped to a Site
// efficiently so Sites can operate independently.  Set this once and
// don't change it.
db.SetSiteURLTemplate("http://localhost:8080/site/{}/")
    
// SetDatabaseURL is a special case page ID for the database's
// metadata page.   Set this once and don't change it.
db.SetDatabaseURL("http://localhost:8080/")

db.SiteURLToName("http://localhost:8080/site/test3/"): "test3"
db.SiteNameToURL("test3"): "http://localhost:8080/site/test3/"


// SHOULD WE ALLOW DETACHED SITES, LIKE THIS?


// NewSite creates a new site structure, not connected to any 
// DB.
site := NewSite()

// AttachSite connects a Site to a DB, so it can be queried, etc.  A
// Site can only be attached to one DB at a time.
db.AttachSite(site, id) err   (id in use, bad id)
db.DetachSite(site) err       (not found)
db.SiteById(id) err           (not found)


// Or...

site := db.NewSite
        db.SiteById
        db.DeleteSite

