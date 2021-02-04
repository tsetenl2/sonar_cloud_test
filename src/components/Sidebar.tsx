import React from "react";
import { Paragraph } from "@contentful/forma-36-react-components";
import { PageExtensionSDK } from "contentful-ui-extensions-sdk";

interface PageProps {
  sdk: PageExtensionSDK;
}

const Sidebar = (props: PageProps) => {
  return <Paragraph>Hello Sidebar Component</Paragraph>;
};

export default Sidebar;
