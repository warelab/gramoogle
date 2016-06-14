import React from 'react';

import {Popover} from "react-bootstrap";

import Features from "./Features.jsx";
import Examples from "./Examples.jsx";

const SearchHelpPopover = () =>
    <Popover className="search-help-popover" placement="bottom" title="Gramene Search Help">
      <Features/>
      <Examples/>
    </Popover>;

export default SearchHelpPopover;