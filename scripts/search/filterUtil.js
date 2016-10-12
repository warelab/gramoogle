import _ from 'lodash';

export function trimFilters(filters) {
  return _.mapValues(
      filters,
      filter => _.pick(filter, 'category', 'display_name', 'fq', 'exclude')
  );
}