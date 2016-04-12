import React from "react";
import {Table} from "react-bootstrap";
import {Detail, Title, Description, Content, Explore, Links} from "./generic/detail.jsx";
import formatXrefsForGene from "./xrefs/formatXrefsForGene";

const Xrefs = ({gene}) => {
  return (
    <Detail>
      <Title>Cross-references</Title>
      <Description>References to this gene in other databases:</Description>
      <Content>
        <Table className="xrefs" condensed hover>
          <thead>
          <tr>
            <th className="xref-name-col">Database</th>
            <th className="xref-value-col">IDs and links</th>
          </tr>
          </thead>
          <tbody>
            {formatXrefsForGene(gene)}
          </tbody>
        </Table>
      </Content>
    </Detail>
  );
};

export default Xrefs;