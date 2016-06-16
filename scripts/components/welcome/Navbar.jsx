import React from 'react';
import {Navbar, Nav, NavItem} from "react-bootstrap";



const WelcomeNavbar = () => <Navbar className="submenu">
  <Nav>
    <NavItem href="//gramene.org/release-notes">Release Notes (v50)</NavItem>
    <NavItem href="//gramene.org/collaborators">Collaborators</NavItem>
    <NavItem href="//gramene.org/contact">Contact</NavItem>
    <NavItem href="//gramene.org/about-gramene">About</NavItem>
    <NavItem href="//gramene.org/archive">Archive</NavItem>
    <NavItem href="//gramene.org/cite">Cite</NavItem>
    <NavItem href="https://www.youtube.com/channel/UCMtmq20XMccsNUaACuqQJ-w">Link</NavItem>
    <NavItem href="//gramene.org/outreach">Outreach</NavItem>
  </Nav>
</Navbar>;

/* <ul id="main-menu-links" class="links clearfix"><li class="menu-221 first active"><a href="/" class="active">Home</a></li>
 <li class="menu-352"><a href="/release-notes">Release Notes</a></li>
 <li class="menu-354"><a href="/collaborators">Collaborators</a></li>
 <li class="menu-409"><a href="/contact" title="">Contact</a></li>
 <li class="menu-374"><a href="/about-gramene">About</a></li>
 <li class="menu-517"><a href="/archive">Archive</a></li>
 <li class="menu-417"><a href="/cite">Citing Gramene</a></li>
 <li class="menu-1424"><a href="https://www.youtube.com/channel/UCMtmq20XMccsNUaACuqQJ-w" title="">Videotutorials</a></li>
 <li class="menu-567 last"><a href="/outreach" title="Outreach events and educational materials">Outreach</a></li>
 </ul> */

export default WelcomeNavbar;