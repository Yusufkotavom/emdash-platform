import Hero from "../../../components/blocks/Hero.astro";
import Capabilities from "../../../components/blocks/Capabilities.astro";
import Features from "../../../components/blocks/Features.astro";
import Testimonials from "../../../components/blocks/Testimonials.astro";
import Pricing from "../../../components/blocks/Pricing.astro";
import FAQ from "../../../components/blocks/FAQ.astro";
import CTA from "../../../components/blocks/CTA.astro";
import Logos from "../../../components/blocks/Logos.astro";
import Split from "../../../components/blocks/Split.astro";
import Stats from "../../../components/blocks/Stats.astro";
import Contact from "../../../components/blocks/Contact.astro";
import Text from "../../../components/blocks/Text.astro";
import FeatureSection from "../../../components/blocks/FeatureSection.astro";
import Slider from "../../../components/blocks/Slider.astro";
import Feed from "../../../components/blocks/Feed.astro";

export const blockComponents = {
	"marketing.hero": Hero,
	"marketing_hero": Hero,
	"marketing.capabilities": Capabilities,
	"marketing_capabilities": Capabilities,
	"marketing.features": Features,
	"marketing_features": Features,
	"marketing.testimonials": Testimonials,
	"marketing_testimonials": Testimonials,
	"marketing.pricing": Pricing,
	"marketing_pricing": Pricing,
	"marketing.faq": FAQ,
	"marketing_faq": FAQ,
	"marketing.cta": CTA,
	"marketing_cta": CTA,
	"marketing.logos": Logos,
	"marketing_logos": Logos,
	"marketing.split": Split,
	"marketing_split": Split,
	"marketing.stats": Stats,
	"marketing_stats": Stats,
	"marketing.contact": Contact,
	"marketing_contact": Contact,
	"marketing.richtext": Text,
	"marketing_richtext": Text,
	"marketing.feature_section": FeatureSection,
	"marketing_feature_section": FeatureSection,
	"marketing.slider": Slider,
	"marketing_slider": Slider,
	"marketing.feed": Feed,
	"marketing_feed": Feed,
};

export default blockComponents;
