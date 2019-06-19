define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var serviceItemsListing = {

		/**
		 * Renders a service items listing
		 * @param  {Object} args
		 * @param  {jQuery} args.container  Element that will contain the listing
		 * @param  {String[]} args.planIds  Array of plan IDs to be used to generate the listing
		 * @param  {Function} [args.success]  Optional success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		serviceItemsListingRender: function(args) {
			var self = this,
				planIds = args.planIds,
				$container = args.container,
				initTemplate = function(data) {
					var categories = self.serviceItemsListingFormatQuoteData(data),
						$template = $(self.getTemplate({
							name: 'layout',
							data: {
								categories: categories
							},
							submodule: 'serviceItemsListing'
						}));

					monster.ui.tooltips($template);

					return $template;
				};

			// An array of functions is used instead of an object, because they need to be
			// executed in an ordered manner
			monster.series([
				function(seriesCallback) {
					monster.ui.insertTemplate($container, function(insertTemplateCallback) {
						seriesCallback(null, insertTemplateCallback);
					});
				},
				function(seriesCallback) {
					if (_.isEmpty(planIds)) {
						seriesCallback(null);
						return;
					}

					self.serviceItemsListingRequestServiceQuote({
						planIds: planIds,
						success: function(listing) {
							seriesCallback(null, listing);
						}
					});
				}
			], function(err, results) {
				if (err) {
					_.has(args, 'error') && args.error(err);
					return;
				}

				var insertTemplateCallback = results[0],
					data = _.get(results, 1);

				insertTemplateCallback(initTemplate(data));

				_.has(args, 'success') && args.success();
			});
		},

		serviceItemsListingFormatQuoteData: function(data) {
			var self = this,
				items = _.get(data, 'invoices[0].items', []),
				plan = _.get(data, 'invoices[0].plan', {});

			return _
				.chain(items)
				.groupBy('category')
				.map(function(items, category) {
					return {
						title: monster.util.tryI18n(self.i18n.active().accountsApp.serviceItemsListing.keys, category),
						category: category,
						items: _
							.chain(items)
							.flatMap(function(fields) {
								return self.serviceItemsListingFieldsFormatData(plan, category, fields.item);
							})
							.sortBy('name')
							.value()
					};
				})
				.sortBy('title')
				.value();
		},

		serviceItemsListingFieldsFormatData: function(plan, categoryName, subCategoryName) {
			var self = this,
				item = _.get(plan, [categoryName, subCategoryName], {}),
				defaultItem = {
					name: item.name || monster.util.tryI18n(self.i18n.active().accountsApp.serviceItemsListing.keys, subCategoryName),
					subCategory: subCategoryName,
					quantity: null,
					rate: {
						value: null,
						isCascade: _.get(item, 'cascade', false)
					},
					isActivationCharges: false,
					discount: null
				},
				formattedItemList = [],
				addRow = function(item) {
					// If we add multiple lines for the same item, then we don't want to repeat the name every time.
					if (formattedItemList.length > 0) {
						if (!item.isActivationCharges) {
							item.name = '';
						}
					}

					formattedItemList.push(item);
				};

			if (_.has(item, 'rate')) {
				var formattedItem = _.cloneDeep(defaultItem);

				formattedItem.rate.value = item.rate;

				// If item has both rate and rates, it means the rate is the price for a number of items exceeding the maximum rates
				if (_.has(item, 'rates')) {
					formattedItem.quantity = '0 - ∞';
				}

				addRow(formattedItem);
			}

			if (_.has(item, 'rates')) {
				// For each rate we want to display a line
				_.each(item.rates, function(value, maxNumber) {
					var formattedItem = _.cloneDeep(defaultItem);

					formattedItem.quantity = '0 - ' + maxNumber;
					formattedItem.rate.value = value;

					addRow(formattedItem);
				});
			}

			if (_.has(item, 'activation_charge') && item.activation_charge > 0) {
				var formattedItem = _.cloneDeep(defaultItem);

				formattedItem.isActivationCharges = true;
				formattedItem.name = self.getTemplate({
					name: '!' + self.i18n.active().accountsApp.serviceItemsListing.labels.activationCharge,
					data: {
						itemName: formattedItem.name
					}
				});
				formattedItem.rate.value = item.activation_charge;

				addRow(formattedItem);
			}

			// Else if no lines were added, we still want to add it to the list, so user knows it's in there
			if (_.isEmpty(formattedItemList)) {
				var formattedItem = _.cloneDeep(defaultItem);
				addRow(formattedItem);
			}

			return formattedItemList;
		},

		/**
		 * Request the aggregate or "quote" for a set of plans
		 * @param  {Object} args
		 * @param  {String[]} args.planIds  List of plans to be included for the quote
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		serviceItemsListingRequestServiceQuote: function(args) {
			var self = this;

			self.callApi({
				resource: 'services.quote',
				data: {
					accountId: self.accountId,
					data: {
						plans: args.planIds
					}
				},
				success: function(data) {
					args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			});
		}
	};

	return serviceItemsListing;
});
