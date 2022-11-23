'use strict'
var debug = require('debug')('price-monitoring:PriceMonitoring')
var async = require('async')
var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var csvParser = require('./util').csvParser
var autoload = require('./util').autoload // loader utility
const SiteParser = require('./SiteParser') // Class

class PriceMonitoring extends EventEmitter {
  constructor (opts) {
    super()
    opts = opts || {}
    var self = this
    this.interval = opts.interval || 60 * 60 * 1000 // default 1h
    this.parsers = []
    debug('parsers directory:', opts.parsersDir)
    if (!opts.hasOwnProperty('parsersDir')) throw Error('Please provide a parsersDir property')
    var siteParsers = autoload(opts.parsersDir)

    Object.keys(siteParsers).forEach(function (pName) {
      /* Get an instance of every parser class */
      if (typeof siteParsers[pName] !== 'function') {
        return debug('Skipping', pName)
      }
      var parser = new siteParsers[pName]()
      if (!(parser instanceof SiteParser)) {
        return debug('Skipping:', pName, 'is not an instance of SiteParser')
      }
      self.parsers.push(parser)
      debug('Instantiating', pName, 'parser')
      /* Istantiate event listeners */
      parser.on('error', self.onParserError.bind(self))
      parser.on('submit', self.onParserSubmit.bind(self))
      parser.on('remove', self.onParserRemove.bind(self))
      parser.on('priceFetched', self.onParserPriceFetched.bind(self))
      parser.on('priceAlert', self.onParserPriceAlert.bind(self))
      parser.on('end', self.onParserEnd.bind(self))
    })

    this.round = 0
    this.productsCount = 0
    this.loopStarted = false
  }

  /* Exposing .SiteParser class */
  static get SiteParser () {
    return SiteParser
  }

  /* Events from the Websites Parsers */
  onParserError (err) {
    this.emit('error', err)
  }

  onParserSubmit (product) {
    this.emit('submit', product)
  }

  onParserRemove (product) {
    this.emit('remove', product)
  }

  onParserPriceFetched (product, currentPrice) {
    this.emit('priceFetched', product, currentPrice)
  }

  onParserPriceAlert (product, newPrice) {
    this.emit('priceAlert', product, newPrice)
  }

  onParserEnd (site, nProducts) {
    this.emit('parserEnd', site, nProducts)
  }

  parseCSV (fileInput) {
    var self = this
    return new Promise(function(resolve, reject) {
      csvParser(fileInput, function (err, productsCSV) {
        if (err) return reject(err)
        /* Add the products */
        productsCSV.forEach(function (product) {
          self.parseAndSubmit(product)
        })
        resolve()
      })
    })
  }

  parseAndSubmit (product, cb) {
    /* Submit the product to his parser */
    var self = this
    var found = false
    this.parsers.forEach(function (pInstance) {
      if (pInstance.doUrlMatch(product.link)) {
        pInstance.addProduct(product)
        found = true
        self.productsCount++
      }
    })
    if (!found) {
      debug('No parser found, skipping:', product)
      this.emit('skip', product)
    }
    cb && cb(found)
    return this
  }

  removeProduct(product, cb) {
    // remove the product from his parser
    var self = this
    var found = false
    this.parsers.forEach(function (pInstance) {
      if (pInstance.doUrlMatch(product.link)) {
        pInstance.delProduct(product)
        found = true
        self.productsCount--
      }
    })
    if (!found) {
      debug('No parser found, skipping:', product)
      this.emit('skip', product)
    }
    cb && cb(found)
    return this
  }

  fetchAllPrices (cb) {
    var self = this
    /* Every parser works in Parallel, and products prices are fetched sequentially. */
    async.each(self.parsers, function (pInstance, done) {
      // fetch prices of every product in the current parser instance
      pInstance.fetchPrices(function (url, nProducts) {
        debug('fetched ' + nProducts + ' for ' + url)
        done()
      })
    }, function (err) {
      if (err) return self.emit('error', err)
      cb && cb()
    })
  }

  watchPrices (cb) {
    /* Fetch and check prices once every this.interval */
    var self = this
    if (this.loopStarted) return debug('Price watch already started.')
    debug('Starting price watch')
    this.startWatch = function () {
      self.watchLoop = setTimeout(function () {
        self.fetchAllPrices(function () { /* all prices from all the parsers fetched */
          self.round++
          debug('All prices fetched for the', self.round + 'th', 'time')
          self.startWatch()
          cb && cb(self.round)
          debug('starting with next round')
        })
      }, self.interval)
      self.loopStarted = true
    }
    this.startWatch()
  }

  isWatchingPrices () {
    return this.loopStarted
  }

  stop () {
    debug('Stopping price watch')
    clearTimeout(this.watchLoop)
    this.loopStarted = false
    this.round = 0
  }

  close () {
    this.stop()
    /* close nightmare drivers */
    this.parsers.forEach(function (p) {
      p.close()
    })
  }

  getParsersList () {
    return this.parsers
  }

  getParsersCount () {
    return this.parsers.length
  }

  getProductsCount () {
    return this.productsCount
  }

  getProducts () {
    return _.flatten(this.parsers.map(function (pInstance) {
      return pInstance.getProducts()
    }))
  }

  isWebsiteCovered (url) {
    return this.parsers.some(function (p) {
      return p.doUrlMatch(url)
    })
  }
}

module.exports = PriceMonitoring
