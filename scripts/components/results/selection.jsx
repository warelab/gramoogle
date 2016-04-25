import React from 'react';
import numeral from 'numeral';

import {Table} from 'react-bootstrap';

import QueryActions from '../../actions/queryActions';

import QueryTerm from '../result/queryTerm.jsx';

import selectionStats from './selectionStats';

const Selection = ({selection, taxonomy}) => {
  const stats = selectionStats(selection, taxonomy);
  const fq = `fixed_200__bin:(${Object.keys(selection).join(' ')})`;
  
  const setFilter = () => {
    QueryActions.removeFilters((f)=>f.category === 'Selection');

    QueryActions.setFilter({
      category: 'Selection',
      id: fq,
      fq: fq,
      display_name: `${stats.selectedGenes} Genes`
    });
  };
  
  const formatProportion = (prop) => '(' + (_.isFinite(prop) ? numeral(prop).format('0.0%') : undefined) + ')';
  
  const name = `${stats.selectedGenes} Genes`;
  return (
    <div>
      <Table>
        <tbody>
          <tr>
            <th>Number of selected genes</th>
            <td>{stats.selectedGenes} {formatProportion(stats.proportionGenesSelected)}</td>
            <td><QueryTerm category="Selection" 
                           count={stats.selectedGenes} 
                           handleClick={setFilter}
            /></td>
          </tr>
        </tbody>
      </Table>
    </div>
  )
};

export default Selection;