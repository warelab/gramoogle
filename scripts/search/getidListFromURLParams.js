import _ from "lodash";

function trimVersion(id) {
  return id.replace(/\.\d+$/,'');
}

export default function getidListFromURLParams() {
  const params = _.get(global.gramene, 'searchParams');
  if (params && params.idList) {
    return _.uniq(_.map(params.idList.split(','), trimVersion));
  }
  return [];
}