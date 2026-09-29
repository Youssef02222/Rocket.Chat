export type PoweredByProps = {
	className?: string;
};

export const PoweredBy = (_props: PoweredByProps) => {
	// FOSS: never show "Powered by Rocket.Chat" in the livechat widget.
	return null;
};

export default PoweredBy;
