import React from 'react';
import numeral from 'numeral';
import _ from "lodash";

import {Table} from 'react-bootstrap';

import QueryActions from '../../actions/queryActions';

import QueryTerm from '../result/queryTerm.jsx';

import selectionStats from './selectionStats';

const Selections = ({selections, taxonomy}) => {
  const stats = selectionStats(selections, taxonomy);
  
  const setFilter = () => {
    QueryActions.removeFilters((f)=>f.category === 'selections');

    QueryActions.setFilter({
      category: 'selections',
      id: stats.fq,
      fq: stats.fq,
      display_name: `${stats.selectedGenes} Genes`
    });
  };

  const formatProportion = (prop) => '(' + (_.isFinite(prop) ? numeral(prop).format('0.0%') : undefined) + ')';

  return (
    <div>
      <Table>
        <tbody>
          <tr>
            <th>Number of selected genes</th>
            <td>{stats.selectedGenes} {formatProportion(stats.proportionGenesSelected)}</td>
            <td><QueryTerm category="selections" 
                           count={stats.selectedGenes} 
                           handleClick={setFilter}
            /></td>
          </tr>
        </tbody>
      </Table>
    </div>
  )
};

export default Selections;