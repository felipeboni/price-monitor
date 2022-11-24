'use strict'
const SiteParser = require('../../lib/PriceMonitoring').SiteParser

/* Class */
class neifanTESTE extends SiteParser {
  constructor () {
    super(
      'https://neifanpratas.com.br/', // base url
      '.price ins .amount bdi@text | slice:2 | replaceComma | float' // price selector
    )
  }
}

module.exports = neifanTESTE

/* Single Example */
if (!module.parent) {
  console.log('neifanTESTE example running...')

  var p = new neifanTESTE()

  p.on('error', console.log)

  p.on('submit', console.log)

  p.on('priceFetched', function (product, currentPrice) {
    console.log(product.name, 'got', currentPrice)
  })

  p.on('priceAlert', function (product, newPrice) {
    console.log('Alert!', product.name, 'got', newPrice)
  })

  p.on('end', function () {
    console.log('End!')
    p.close() // shutdown driver
  })
}
