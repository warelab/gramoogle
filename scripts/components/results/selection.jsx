import React from 'react';

import {Table} from 'react-bootstrap';

import selectionStats from './selectionStats';

const Selection = ({selection, taxonomy}) => {
  const stats = selectionStats(selection, taxonomy);
  
  return (
    <div>
      <Table>
        <tbody>
          <tr>
            <th>Selected Genes</th>
            <td>stats.</td>
          </tr>
        </tbody>
      </Table>
    </div>
  )
};

export default Selection;