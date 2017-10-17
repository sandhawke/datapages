/*

  Use data-sentences, hooked of view({ defs: [ ... ] }), to make
  interoperability based on filled-in templates instead of property
  names.

  br = new DefBridge({db: inmem/flatfile/pg})
  br.connect(db1)
  br.connect(db2)

  now db1 and db2 are bridged, to the extent they can be using defs
  
*/

