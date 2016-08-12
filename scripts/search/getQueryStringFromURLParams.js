import queryString from 'query-string';

export default function getQueryStringFromURLParams() {
  if(global.location) {
    const params = queryString.parse(global.location.search);
    const query = params.query || params.q;
    if(query) {
      return query;
    }
  }
  return '';
}