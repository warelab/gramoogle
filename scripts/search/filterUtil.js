import _ from 'lodash';

export function trimFilters(filters) {
  return _.mapValues(filters, function trimProps(filter) {
    return _.pick(filter, 'category', 'display_name', 'fq');
  });
}