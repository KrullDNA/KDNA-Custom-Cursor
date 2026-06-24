<?php
/**
 * Settings page markup for KDNA Custom Cursor.
 *
 * A single page with three tabs and a sticky live preview pane on the right.
 * The working state lives in the Alpine.js component kdnaCcAdmin, defined in
 * admin/js/kdna-cc-admin.js. The builder supports the Shape, Image and Text
 * cursor types, each with a Normal and Hover state, and the live preview is
 * driven by the shared engine.
 *
 * @package KDNA_Custom_Cursor
 */

// Stop anyone loading this file directly outside of WordPress.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define the small markup helpers once.
if ( ! function_exists( 'kdna_cc_slider' ) ) {

/**
 * Echo the markup for one numeric slider control with a paired number entry.
 *
 * A small local helper so the Image and Text builders stay readable. The path
 * is an Alpine expression that resolves to the value, for example
 * stateBlock().width or stateBlock().background.height.
 *
 * @param string $label The control label.
 * @param string $path  The Alpine expression for the bound value.
 * @param int    $max   The slider maximum.
 * @return void
 */
function kdna_cc_slider( $label, $path, $max ) {
	?>
	<div class="kdna-cc-control">
		<label class="kdna-cc-control-label"><?php echo esc_html( $label ); ?></label>
		<div class="kdna-cc-control-input">
			<div class="kdna-cc-range">
				<input type="range" min="0" max="<?php echo esc_attr( $max ); ?>" step="1" x-model.number="<?php echo esc_attr( $path ); ?>">
				<input type="number" class="small-text" min="0" max="<?php echo esc_attr( $max ); ?>" x-model.number="<?php echo esc_attr( $path ); ?>">
				<span class="kdna-cc-unit">px</span>
			</div>
		</div>
	</div>
	<?php
}

/**
 * Echo the markup for a colour control (a swatch plus a free text field).
 *
 * @param string $label The control label.
 * @param string $path  The Alpine expression for the bound colour.
 * @return void
 */
function kdna_cc_colour( $label, $path ) {
	?>
	<div class="kdna-cc-control">
		<label class="kdna-cc-control-label"><?php echo esc_html( $label ); ?></label>
		<div class="kdna-cc-control-input">
			<div class="kdna-cc-colour">
				<input type="color" :value="toHex(<?php echo esc_attr( $path ); ?>)" @input="<?php echo esc_attr( $path ); ?> = $event.target.value">
				<input type="text" class="regular-text" x-model="<?php echo esc_attr( $path ); ?>" placeholder="<?php esc_attr_e( 'hex, rgba or transparent', 'kdna-custom-cursor' ); ?>">
			</div>
		</div>
	</div>
	<?php
}

/**
 * Echo the markup for a blend mode dropdown bound to an Alpine path.
 *
 * @param string $path The Alpine expression for the bound value.
 * @return void
 */
function kdna_cc_blend_select( $path ) {
	?>
	<div class="kdna-cc-control">
		<label class="kdna-cc-control-label"><?php esc_html_e( 'Blending mode', 'kdna-custom-cursor' ); ?></label>
		<div class="kdna-cc-control-input">
			<select x-model="<?php echo esc_attr( $path ); ?>">
				<option value="normal">normal</option>
				<option value="difference">difference</option>
				<option value="multiply">multiply</option>
				<option value="screen">screen</option>
				<option value="exclusion">exclusion</option>
			</select>
		</div>
	</div>
	<?php
}

} // End the function_exists guard for the template helpers.
?>
<div class="wrap kdna-cc-wrap" x-data="kdnaCcAdmin" x-cloak>

	<h1 class="kdna-cc-title"><?php esc_html_e( 'KDNA Custom Cursor', 'kdna-custom-cursor' ); ?></h1>
	<p class="kdna-cc-subtitle">
		<?php esc_html_e( 'Build custom cursors and assign them to CSS classes on your Elementor pages.', 'kdna-custom-cursor' ); ?>
	</p>

	<div class="kdna-cc-layout">

		<div class="kdna-cc-main">

			<nav class="kdna-cc-tabs nav-tab-wrapper">
				<button type="button" class="nav-tab" :class="{ 'nav-tab-active': activeTab === 'library' }" @click="setTab('library')">
					<?php esc_html_e( 'Library', 'kdna-custom-cursor' ); ?>
				</button>
				<button type="button" class="nav-tab" :class="{ 'nav-tab-active': activeTab === 'builder' }" @click="setTab('builder')">
					<?php esc_html_e( 'Builder', 'kdna-custom-cursor' ); ?>
				</button>
				<button type="button" class="nav-tab" :class="{ 'nav-tab-active': activeTab === 'assignment' }" @click="setTab('assignment')">
					<?php esc_html_e( 'Assignment & Options', 'kdna-custom-cursor' ); ?>
				</button>
			</nav>

			<div class="kdna-cc-panels">

				<?php // Tab 1, Cursor Library. ?>
				<section class="kdna-cc-panel" x-show="activeTab === 'library'">
					<div class="kdna-cc-panel-top">
						<h2><?php esc_html_e( 'Cursor Library', 'kdna-custom-cursor' ); ?></h2>
						<div class="kdna-cc-segment">
							<button type="button" @click="newCursor('shape')"><?php esc_html_e( 'New Shape', 'kdna-custom-cursor' ); ?></button>
							<button type="button" @click="newCursor('image')"><?php esc_html_e( 'New Image', 'kdna-custom-cursor' ); ?></button>
							<button type="button" @click="newCursor('text')"><?php esc_html_e( 'New Text', 'kdna-custom-cursor' ); ?></button>
						</div>
					</div>

					<p class="kdna-cc-placeholder" x-show="cursors.length === 0">
						<?php esc_html_e( 'No cursors yet. Create your first cursor to get started. The original KDNA starter presets arrive in Stage 6.', 'kdna-custom-cursor' ); ?>
					</p>

					<div class="kdna-cc-grid" x-show="cursors.length > 0">
						<template x-for="cursor in cursors" :key="cursor.id">
							<div class="kdna-cc-card">
								<div class="kdna-cc-thumb" x-effect="renderThumb($el, cursor)"></div>
								<div class="kdna-cc-card-body">
									<span class="kdna-cc-card-name" x-text="cursor.name || 'Untitled cursor'"></span>
									<span class="kdna-cc-badge" x-text="cursor.type"></span>
								</div>
								<div class="kdna-cc-card-actions">
									<button type="button" class="button button-small" @click="editCursor(cursor.id)">
										<?php esc_html_e( 'Edit', 'kdna-custom-cursor' ); ?>
									</button>
									<button type="button" class="button button-small" @click="duplicateCursor(cursor.id)">
										<?php esc_html_e( 'Duplicate', 'kdna-custom-cursor' ); ?>
									</button>
									<button type="button" class="button button-small button-link-delete" @click="deleteCursor(cursor.id)">
										<?php esc_html_e( 'Delete', 'kdna-custom-cursor' ); ?>
									</button>
								</div>
							</div>
						</template>
					</div>
				</section>

				<?php // Tab 2, Builder. ?>
				<section class="kdna-cc-panel" x-show="activeTab === 'builder'">

					<template x-if="!editing">
						<div class="kdna-cc-empty">
							<h2><?php esc_html_e( 'Builder', 'kdna-custom-cursor' ); ?></h2>
							<p class="kdna-cc-placeholder">
								<?php esc_html_e( 'Pick a cursor in the Library to edit, or create a new one.', 'kdna-custom-cursor' ); ?>
							</p>
							<button type="button" class="button button-primary" @click="newCursor('shape')">
								<?php esc_html_e( 'Create New Cursor', 'kdna-custom-cursor' ); ?>
							</button>
						</div>
					</template>

					<template x-if="editing">
						<div class="kdna-cc-builder">

							<div class="kdna-cc-builder-head">
								<label class="kdna-cc-name-field">
									<span><?php esc_html_e( 'Name', 'kdna-custom-cursor' ); ?></span>
									<input type="text" x-model="editing.name" placeholder="<?php esc_attr_e( 'Cursor name', 'kdna-custom-cursor' ); ?>">
								</label>

								<div class="kdna-cc-type-select">
									<span class="kdna-cc-field-label"><?php esc_html_e( 'Type', 'kdna-custom-cursor' ); ?></span>
									<div class="kdna-cc-segment">
										<button type="button" :class="{ active: editing.type === 'shape' }" @click="setType('shape')"><?php esc_html_e( 'Shape', 'kdna-custom-cursor' ); ?></button>
										<button type="button" :class="{ active: editing.type === 'image' }" @click="setType('image')"><?php esc_html_e( 'Image', 'kdna-custom-cursor' ); ?></button>
										<button type="button" :class="{ active: editing.type === 'text' }" @click="setType('text')"><?php esc_html_e( 'Text', 'kdna-custom-cursor' ); ?></button>
									</div>
								</div>
							</div>

							<?php // Normal and Hover state toggle, shared by every type. ?>
							<div class="kdna-cc-state-toggle">
								<span class="kdna-cc-field-label"><?php esc_html_e( 'Editing state', 'kdna-custom-cursor' ); ?></span>
								<div class="kdna-cc-segment">
									<button type="button" :class="{ active: editingState === 'normal' }" @click="editingState = 'normal'"><?php esc_html_e( 'Normal', 'kdna-custom-cursor' ); ?></button>
									<button type="button" :class="{ active: editingState === 'hover' }" @click="editingState = 'hover'"><?php esc_html_e( 'Hover', 'kdna-custom-cursor' ); ?></button>
								</div>
							</div>

							<?php // Shape builder: collapsible Inner Circle and Outer Circle panels. ?>
							<template x-if="editing.type === 'shape'">
								<div class="kdna-cc-shape-builder">
									<template x-for="layerKey in ['inner', 'outer']" :key="layerKey">
										<div class="kdna-cc-panel-group">
											<button type="button" class="kdna-cc-panel-head" @click="togglePanel(layerKey)">
												<span x-text="layerKey === 'inner' ? '<?php echo esc_js( __( 'Inner Circle', 'kdna-custom-cursor' ) ); ?>' : '<?php echo esc_js( __( 'Outer Circle', 'kdna-custom-cursor' ) ); ?>'"></span>
												<span class="kdna-cc-caret" x-text="panelsOpen[layerKey] ? '▾' : '▸'"></span>
											</button>
											<div class="kdna-cc-panel-body" x-show="panelsOpen[layerKey]">
												<template x-for="ctrl in controlsFor(layerKey)" :key="ctrl.key">
													<div class="kdna-cc-control">
														<label class="kdna-cc-control-label" x-text="ctrl.label"></label>
														<div class="kdna-cc-control-input">

															<template x-if="ctrl.type === 'range'">
																<div class="kdna-cc-range">
																	<input type="range" :min="ctrl.min" :max="ctrl.max" :step="ctrl.step"
																		:value="getVal(layerKey, ctrl.key)"
																		@input="setVal(layerKey, ctrl, $event.target.value)">
																	<input type="number" class="small-text" :min="ctrl.min" :max="ctrl.max" :step="ctrl.step"
																		:value="getVal(layerKey, ctrl.key)"
																		@input="setVal(layerKey, ctrl, $event.target.value)">
																	<span class="kdna-cc-unit" x-text="ctrl.unit"></span>
																</div>
															</template>

															<template x-if="ctrl.type === 'number'">
																<input type="number" class="small-text"
																	:value="getVal(layerKey, ctrl.key)"
																	@input="setVal(layerKey, ctrl, $event.target.value)">
															</template>

															<template x-if="ctrl.type === 'select'">
																<select :value="getVal(layerKey, ctrl.key)" @change="setVal(layerKey, ctrl, $event.target.value)">
																	<template x-for="opt in ctrl.options" :key="opt">
																		<option :value="opt" :selected="opt === getVal(layerKey, ctrl.key)" x-text="opt"></option>
																	</template>
																</select>
															</template>

															<template x-if="ctrl.type === 'text'">
																<input type="text" class="regular-text" :placeholder="ctrl.placeholder"
																	:value="getVal(layerKey, ctrl.key)"
																	@input="setVal(layerKey, ctrl, $event.target.value)">
															</template>

															<template x-if="ctrl.type === 'colour'">
																<div class="kdna-cc-colour">
																	<input type="color" :value="hexFor(layerKey, ctrl.key)"
																		@input="setVal(layerKey, ctrl, $event.target.value)">
																	<input type="text" class="regular-text" placeholder="<?php esc_attr_e( 'hex, rgba or transparent', 'kdna-custom-cursor' ); ?>"
																		:value="getVal(layerKey, ctrl.key)"
																		@input="setVal(layerKey, ctrl, $event.target.value)">
																</div>
															</template>

														</div>
													</div>
												</template>
											</div>
										</div>
									</template>
								</div>
							</template>

							<?php // Image builder: a media library picker plus size, blend and z-index. ?>
							<template x-if="editing.type === 'image'">
								<div class="kdna-cc-type-builder">
									<div class="kdna-cc-control kdna-cc-control-wide">
										<label class="kdna-cc-control-label"><?php esc_html_e( 'Image', 'kdna-custom-cursor' ); ?></label>
										<div class="kdna-cc-control-input">
											<div class="kdna-cc-image-preview" x-show="stateBlock().url">
												<img :src="stateBlock().url" alt="">
											</div>
											<p class="kdna-cc-image-buttons">
												<button type="button" class="button" @click="pickImage()"><?php esc_html_e( 'Select image', 'kdna-custom-cursor' ); ?></button>
												<button type="button" class="button" x-show="stateBlock().url" @click="clearImage()"><?php esc_html_e( 'Remove image', 'kdna-custom-cursor' ); ?></button>
											</p>
											<p class="description"><?php esc_html_e( 'A PNG or SVG from the media library.', 'kdna-custom-cursor' ); ?></p>
										</div>
									</div>
									<?php kdna_cc_slider( __( 'Width', 'kdna-custom-cursor' ), 'stateBlock().width', 400 ); ?>
									<?php kdna_cc_slider( __( 'Height', 'kdna-custom-cursor' ), 'stateBlock().height', 400 ); ?>
									<?php kdna_cc_blend_select( 'stateBlock().blendMode' ); ?>
									<div class="kdna-cc-control">
										<label class="kdna-cc-control-label"><?php esc_html_e( 'Z-index', 'kdna-custom-cursor' ); ?></label>
										<div class="kdna-cc-control-input">
											<input type="number" class="small-text" x-model.number="stateBlock().zIndex">
										</div>
									</div>
								</div>
							</template>

							<?php // Text builder: a word or emoji with an optional background shape. ?>
							<template x-if="editing.type === 'text'">
								<div class="kdna-cc-type-builder">
									<div class="kdna-cc-control">
										<label class="kdna-cc-control-label"><?php esc_html_e( 'Text or emoji', 'kdna-custom-cursor' ); ?></label>
										<div class="kdna-cc-control-input">
											<input type="text" class="regular-text" x-model="stateBlock().value" placeholder="<?php esc_attr_e( 'View', 'kdna-custom-cursor' ); ?>">
										</div>
									</div>
									<div class="kdna-cc-control">
										<label class="kdna-cc-control-label"><?php esc_html_e( 'Font family', 'kdna-custom-cursor' ); ?></label>
										<div class="kdna-cc-control-input">
											<input type="text" class="regular-text" x-model="stateBlock().font" placeholder="<?php esc_attr_e( 'e.g. Inter, sans-serif', 'kdna-custom-cursor' ); ?>">
										</div>
									</div>
									<?php kdna_cc_slider( __( 'Font size', 'kdna-custom-cursor' ), 'stateBlock().size', 120 ); ?>
									<div class="kdna-cc-control">
										<label class="kdna-cc-control-label"><?php esc_html_e( 'Font weight', 'kdna-custom-cursor' ); ?></label>
										<div class="kdna-cc-control-input">
											<select x-model="stateBlock().weight">
												<option value="normal">normal</option>
												<option value="300">300</option>
												<option value="400">400</option>
												<option value="500">500</option>
												<option value="600">600</option>
												<option value="700">700</option>
												<option value="800">800</option>
												<option value="900">900</option>
												<option value="bold">bold</option>
											</select>
										</div>
									</div>
									<?php kdna_cc_colour( __( 'Colour', 'kdna-custom-cursor' ), 'stateBlock().color' ); ?>
									<?php kdna_cc_blend_select( 'stateBlock().blendMode' ); ?>
									<div class="kdna-cc-control">
										<label class="kdna-cc-control-label"><?php esc_html_e( 'Z-index', 'kdna-custom-cursor' ); ?></label>
										<div class="kdna-cc-control-input">
											<input type="number" class="small-text" x-model.number="stateBlock().zIndex">
										</div>
									</div>

									<div class="kdna-cc-subhead"><?php esc_html_e( 'Background', 'kdna-custom-cursor' ); ?></div>
									<div class="kdna-cc-control">
										<label class="kdna-cc-control-label"><?php esc_html_e( 'Shape', 'kdna-custom-cursor' ); ?></label>
										<div class="kdna-cc-control-input">
											<select x-model="stateBlock().background.shape">
												<option value="none"><?php esc_html_e( 'None', 'kdna-custom-cursor' ); ?></option>
												<option value="circle"><?php esc_html_e( 'Circle', 'kdna-custom-cursor' ); ?></option>
												<option value="pill"><?php esc_html_e( 'Pill', 'kdna-custom-cursor' ); ?></option>
											</select>
										</div>
									</div>
									<template x-if="stateBlock().background.shape !== 'none'">
										<div>
											<?php kdna_cc_slider( __( 'Width', 'kdna-custom-cursor' ), 'stateBlock().background.width', 300 ); ?>
											<?php kdna_cc_slider( __( 'Height', 'kdna-custom-cursor' ), 'stateBlock().background.height', 300 ); ?>
											<?php kdna_cc_colour( __( 'Fill', 'kdna-custom-cursor' ), 'stateBlock().background.fill' ); ?>
											<?php kdna_cc_slider( __( 'Border width', 'kdna-custom-cursor' ), 'stateBlock().background.borderWidth', 20 ); ?>
											<?php kdna_cc_colour( __( 'Border colour', 'kdna-custom-cursor' ), 'stateBlock().background.borderColor' ); ?>
											<div class="kdna-cc-control">
												<label class="kdna-cc-control-label"><?php esc_html_e( 'Border radius', 'kdna-custom-cursor' ); ?></label>
												<div class="kdna-cc-control-input">
													<input type="text" class="regular-text" x-model="stateBlock().background.borderRadius" placeholder="100% or 12px">
												</div>
											</div>
										</div>
									</template>
								</div>
							</template>

							<?php // The cursor's own internal hover trigger, shared by every type. ?>
							<div class="kdna-cc-control kdna-cc-control-wide">
								<label class="kdna-cc-control-label"><?php esc_html_e( 'Internal hover trigger', 'kdna-custom-cursor' ); ?></label>
								<div class="kdna-cc-control-input">
									<input type="text" class="regular-text" x-model="editing.hoverSelector" placeholder="a, button">
									<p class="description"><?php esc_html_e( 'The selector that switches this cursor to its own Hover state, for example a, button.', 'kdna-custom-cursor' ); ?></p>
								</div>
							</div>

							<div class="kdna-cc-builder-actions">
								<button type="button" class="button button-primary" @click="saveCursor()" :disabled="saving">
									<span x-show="!saving"><?php esc_html_e( 'Save Cursor', 'kdna-custom-cursor' ); ?></span>
									<span x-show="saving" x-cloak><?php esc_html_e( 'Saving...', 'kdna-custom-cursor' ); ?></span>
								</button>
								<button type="button" class="button" @click="cancelEdit()"><?php esc_html_e( 'Back to Library', 'kdna-custom-cursor' ); ?></button>
							</div>

						</div>
					</template>

				</section>

				<?php // Tab 3, Assignment and Options. ?>
				<section class="kdna-cc-panel" x-show="activeTab === 'assignment'">
					<h2><?php esc_html_e( 'Assignment & Options', 'kdna-custom-cursor' ); ?></h2>

					<template x-if="!settings">
						<p class="kdna-cc-placeholder"><?php esc_html_e( 'Loading settings...', 'kdna-custom-cursor' ); ?></p>
					</template>

					<template x-if="settings">
						<div>

							<?php // Global cursor dropdown. ?>
							<div class="kdna-cc-field-block">
								<label class="kdna-cc-field-label" for="kdna-cc-global"><?php esc_html_e( 'Global cursor', 'kdna-custom-cursor' ); ?></label>
								<select id="kdna-cc-global" :value="settings.globalCursorId || ''" @change="setGlobalCursor($event.target.value)">
									<option value=""><?php esc_html_e( 'None (use the native cursor)', 'kdna-custom-cursor' ); ?></option>
									<template x-for="c in cursors" :key="c.id">
										<option :value="c.id" :selected="c.id === settings.globalCursorId" x-text="c.name || c.id"></option>
									</template>
								</select>
								<p class="description"><?php esc_html_e( 'The cursor used across the whole site, except where a class rule below applies.', 'kdna-custom-cursor' ); ?></p>
							</div>

							<?php // Class to cursor rules, ordered, first match wins. ?>
							<div class="kdna-cc-field-block">
								<h3><?php esc_html_e( 'Class to cursor rules', 'kdna-custom-cursor' ); ?></h3>
								<p class="description"><?php esc_html_e( 'Map a CSS class or selector to a saved cursor. Rules are evaluated top to bottom, first match wins, so put specific rules above broad ones.', 'kdna-custom-cursor' ); ?></p>

								<p class="kdna-cc-placeholder" x-show="settings.rules.length === 0">
									<?php esc_html_e( 'No rules yet. Add a rule to map a class to a cursor.', 'kdna-custom-cursor' ); ?>
								</p>

								<div class="kdna-cc-rules" x-show="settings.rules.length > 0">
									<div class="kdna-cc-rule-row kdna-cc-rule-head">
										<span><?php esc_html_e( 'Order', 'kdna-custom-cursor' ); ?></span>
										<span><?php esc_html_e( 'Selector', 'kdna-custom-cursor' ); ?></span>
										<span><?php esc_html_e( 'Cursor', 'kdna-custom-cursor' ); ?></span>
										<span><?php esc_html_e( 'Actions', 'kdna-custom-cursor' ); ?></span>
									</div>
									<template x-for="(rule, idx) in settings.rules" :key="rule._k">
										<div class="kdna-cc-rule-row">
											<span class="kdna-cc-rule-order" x-text="idx + 1"></span>
											<input type="text" class="regular-text" x-model="rule.selector" placeholder=".my-class">
											<select :value="rule.cursorId" @change="rule.cursorId = $event.target.value">
												<option value=""><?php esc_html_e( 'Select a cursor', 'kdna-custom-cursor' ); ?></option>
												<template x-for="c in cursors" :key="c.id">
													<option :value="c.id" :selected="c.id === rule.cursorId" x-text="c.name || c.id"></option>
												</template>
											</select>
											<div class="kdna-cc-rule-actions">
												<button type="button" class="button button-small" @click="moveRule(idx, -1)" :disabled="idx === 0"><?php esc_html_e( 'Up', 'kdna-custom-cursor' ); ?></button>
												<button type="button" class="button button-small" @click="moveRule(idx, 1)" :disabled="idx === settings.rules.length - 1"><?php esc_html_e( 'Down', 'kdna-custom-cursor' ); ?></button>
												<button type="button" class="button button-small button-link-delete" @click="removeRule(idx)"><?php esc_html_e( 'Remove', 'kdna-custom-cursor' ); ?></button>
											</div>
										</div>
									</template>
								</div>

								<p>
									<button type="button" class="button" @click="addRule()"><?php esc_html_e( 'Add rule', 'kdna-custom-cursor' ); ?></button>
								</p>
							</div>

							<?php // Option toggles arrive in Stage 6. ?>
							<div class="kdna-cc-field-block">
								<h3><?php esc_html_e( 'Options', 'kdna-custom-cursor' ); ?></h3>
								<p class="kdna-cc-placeholder">
									<?php esc_html_e( 'The option toggles (show native cursor, hide on tablet and mobile, hide in admin, respect reduced motion) arrive in Stage 6.', 'kdna-custom-cursor' ); ?>
								</p>
							</div>

							<div class="kdna-cc-builder-actions">
								<button type="button" class="button button-primary" @click="saveAssignment()" :disabled="saving">
									<span x-show="!saving"><?php esc_html_e( 'Save Assignment', 'kdna-custom-cursor' ); ?></span>
									<span x-show="saving" x-cloak><?php esc_html_e( 'Saving...', 'kdna-custom-cursor' ); ?></span>
								</button>
							</div>

						</div>
					</template>
				</section>

			</div>

			<div class="kdna-cc-footer">
				<button type="button" class="button" @click="load()" :disabled="loading">
					<?php esc_html_e( 'Reload from server', 'kdna-custom-cursor' ); ?>
				</button>
				<span class="kdna-cc-message" :class="messageType" x-text="message" x-show="message" x-cloak></span>
			</div>

		</div>

		<?php // Sticky live preview pane, driven by the shared engine. ?>
		<aside class="kdna-cc-preview">
			<h2 class="kdna-cc-preview-title"><?php esc_html_e( 'Live Preview', 'kdna-custom-cursor' ); ?></h2>
			<div class="kdna-cc-preview-stage" x-ref="stage" x-effect="renderPreview()" :class="{ 'is-cursor-on': editing }">
				<div class="kdna-cc-sample">
					<button type="button" class="kdna-cc-sample-btn"><?php esc_html_e( 'Button', 'kdna-custom-cursor' ); ?></button>
					<a href="#" class="kdna-cc-sample-link" @click.prevent><?php esc_html_e( 'A link', 'kdna-custom-cursor' ); ?></a>
					<input type="text" class="kdna-cc-sample-input" placeholder="<?php esc_attr_e( 'Text field', 'kdna-custom-cursor' ); ?>">
				</div>
				<p class="kdna-cc-preview-hint" x-show="!editing">
					<?php esc_html_e( 'Create or edit a cursor to preview it here.', 'kdna-custom-cursor' ); ?>
				</p>
			</div>
			<p class="kdna-cc-preview-note">
				<?php esc_html_e( 'The preview uses the same engine as the front end. Move over the button or link to see the Hover state.', 'kdna-custom-cursor' ); ?>
			</p>
		</aside>

	</div>

</div>
