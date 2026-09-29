import { type ComponentChildren } from 'preact';

import { Footer, FooterContent } from '../Footer';

export type ScreenFooterProps = {
	children?: ComponentChildren;
	options?: ComponentChildren;
	limit?: ComponentChildren;
};

const ScreenFooter = ({ children, options, limit }: ScreenFooterProps) => {
	return (
		<Footer>
			{children && <FooterContent>{children}</FooterContent>}
			<FooterContent>
				{options}
				{limit}
			</FooterContent>
		</Footer>
	);
};

export default ScreenFooter;
