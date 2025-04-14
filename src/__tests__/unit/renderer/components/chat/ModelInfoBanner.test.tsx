import React from 'react';
import { render, screen } from '@testing-library/react';
import ModelInfoBanner from '../../../../../renderer/components/chat/ModelInfoBanner';

describe('ModelInfoBanner', () => {
    it('renders the model information banner with correct message', () => {
        render(<ModelInfoBanner />);

        expect(screen.getByText('Note:')).toBeInTheDocument();
        expect(screen.getByText(/Select your preferred model/)).toBeInTheDocument();
    });

    it('has the correct styling classes', () => {
        const { container } = render(<ModelInfoBanner />);
        const banner = container.firstChild as HTMLElement;

        expect(banner).toHaveClass('bg-blue-50');
        expect(banner).toHaveClass('dark:bg-blue-900/20');
        expect(banner).toHaveClass('text-blue-800');
        expect(banner).toHaveClass('dark:text-blue-200');
    });
}); 