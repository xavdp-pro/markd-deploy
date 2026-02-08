import React from 'react';

interface MarkdownLinkHandlerProps {
  href?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

const MarkdownLinkHandler: React.FC<MarkdownLinkHandlerProps> = (props) => {
  const { href, children, ...rest } = props;
  
  // Detect internal links (doc, task, password, file, schema)
  const isInternalLink = href && (
    href.includes('#doc=') || 
    href.includes('#task=') || 
    href.includes('#password=') ||
    href.includes('#file=') ||
    href.includes('#schema=')
  );

  // Internal links open in new tab, external links follow default behavior
  return (
    <a
      {...rest}
      href={href}
      target={isInternalLink ? '_blank' : undefined}
      rel={isInternalLink ? 'noopener noreferrer' : undefined}
      className="text-blue-600 dark:text-blue-400 hover:underline"
    >
      {children}
    </a>
  );
};

export default MarkdownLinkHandler;
