declare global {
    const electron: {
        fs: {
            exists: jest.Mock;
            mkdir: jest.Mock;
            readFile: jest.Mock;
            writeFile: jest.Mock;
            readdir: jest.Mock;
            unlink: jest.Mock;
        };
        path: {
            join: jest.Mock;
            dirname: jest.Mock;
        };
    };
}

export { }; 