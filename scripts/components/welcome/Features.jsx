import React from 'react';

const Features = () => <div>
  <h3 className="hidden-xs">Features</h3>

  <div className="features row hidden-xs">
    <div className="feature col-sm-4">
      <div className="well">
        <strong>Suggestions</strong>
        <p>Suggested terms are provided as you type:</p>
        <img className="img-responsive" src="assets/images/welcome/suggestions.png"/>
      </div>
    </div>

    <div className="feature col-sm-4">
      <div className="well">
        <strong>Visualization</strong>
        <p>See the distribution of results across all genomes:</p>
        <img className="img-responsive" src="assets/images/welcome/vis.png"/>
      </div>
    </div>

    <div className="feature col-sm-4">
      <div className="well">
        <strong>Gene view</strong>
        <p>Concise view of available information about a gene:</p>
        <img className="img-responsive" src="assets/images/welcome/gene_view.png"/>
      </div>
    </div>
  </div>

</div>;

export default Features;