import _ from "lodash";

export default function getidListFromURLParams() {
  const params = _.get(global.gramene, 'searchParams');
  if (params && params.idList) {
    return _.uniq(params.idList.split(','));
  }
  return [];
}