import React from 'react'

const StaticSocialButtons = () =>
  <ul className="nav navbar-nav navbar-right social">
    <li>
      <iframe src="https://www.facebook.com/plugins/like.php?href=https%3A%2F%2Fwww.facebook.com%2FGramene&amp;layout=button_count&amp;show_faces=false&amp;width=80&amp;font=arial&amp;height=20&amp;action=like&amp;colorscheme=light&amp;locale=en_US&amp;send=false&amp;share=false"
              scrolling="no"
              frameBorder="0"
              style={{border: 'none', overflow: 'hidden', width: '80px', height: '20px'}}
              allowTransparency="true">
      </iframe>
    </li>
    <li>
      <a href="https://twitter.com/GrameneDatabase"
         className="twitter-follow-button"
         data-show-count="true">
        Follow @Gramene
      </a>
    </li>
  </ul>
;

export default StaticSocialButtons;