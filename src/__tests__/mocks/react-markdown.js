// Mock for react-markdown
const ReactMarkdown = ({ children }) => {
    return children;
};

ReactMarkdown.defaultProps = {
    remarkPlugins: [],
};

module.exports = ReactMarkdown; 