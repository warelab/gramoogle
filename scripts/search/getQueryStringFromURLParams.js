import _ from "lodash";

export default function getQueryStringFromURLParams() {
  const params = _.get(global.gramene, 'searchParams');
  if (params) {
    return params.query || params.q || '';
  }
  return '';
}