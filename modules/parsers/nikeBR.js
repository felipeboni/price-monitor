'use strict'
const SiteParser = require('../../lib/PriceMonitoring').SiteParser

/* Class */
class nikeBR extends SiteParser {
  constructor () {
    super(
      'https://www.nike.com.br', // base url
      '[aria-label="preço antigo"], [data-testid="pricebox"] @html | trim | split:" ",1 | replaceComma | float' // price selector
    )
  }
}

module.exports = nikeBR

/* Single Example */
if (!module.parent) {
  console.log('nikeBR example running...')

  var p = new nikeBR()

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

  p.addProduct({
    name: 'Chinelo Nike Asuna 2 Masculino',
    link: 'https://www.nike.com.br/chinelo-nike-asuna-2-masculino-012744.html',
    price: 299.99,
    variation: 18
  }).fetchPrices()
}
