import React from 'react';

import {Popover, Alert} from "react-bootstrap";

import Features from "./Features.jsx";
import Examples from "./Examples.jsx";

const SearchHelpPopover = () =>
    <Popover id="search-help-popover"
             className="search-help-popover"
             placement="bottom"
             title="Gramene Search Help"
             onClick={(e)=>e.stopPropagation()}>
      <Alert bsStyle="info">
        Type to search! Try typing a gene identifier,
        ontology term, pathway, or functional domain
      </Alert>
      <Features/>
      <Examples/>
    </Popover>;

export default SearchHelpPopover;