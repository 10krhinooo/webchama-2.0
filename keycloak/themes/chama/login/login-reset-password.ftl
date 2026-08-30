<#--
  Chama override of the base Keycloak login-reset-password.ftl.

  Without this the flow falls through to the stock PatternFly form markup, which carries its own
  grid and negative margins. Those escape this theme's card padding on a narrow screen, so the
  label and input sit wider than the card they are meant to be inside. It also renders the
  explanatory text after the submit button, where it is an afterthought rather than the
  instruction it is.

  Hand-built to match login.ftl's card exactly: heading, subtitle, one field, one submit, and the
  way back as a footer link.
-->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=true displayMessage=!messagesPerField.existsError('username'); section>
    <#if section = "header">
        ${msg("emailForgotTitle")}
    <#elseif section = "form">
        <p class="chama-card-sub">
            Enter the email address or username on your account and we will send you a link to set
            a new password.
        </p>
        <form id="kc-reset-password-form" class="chama-form" action="${url.loginAction}" method="post">
            <div class="chama-field">
                <label for="username" class="chama-label">
                    <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
                </label>
                <input type="text" id="username" name="username" class="pf-c-form-control" autofocus
                       value="${(auth.attemptedUsername!'')}"
                       aria-invalid="<#if messagesPerField.existsError('username')>true</#if>"/>
                <#if messagesPerField.existsError('username')>
                    <div id="input-error-username" class="chama-alert chama-alert-danger" role="alert" aria-live="polite">
                        <svg class="chama-alert-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                            <circle cx="10" cy="10" r="8"/>
                            <path d="M10 6v4.5M10 13.5h.01" stroke-linecap="round"/>
                        </svg>
                        <span>${kcSanitize(messagesPerField.get('username'))?no_esc}</span>
                    </div>
                </#if>
            </div>

            <button class="pf-c-button pf-m-primary pf-m-block chama-btn-submit" type="submit">
                ${msg("doSubmit")}
            </button>
        </form>
    <#elseif section = "info">
        <#-- template.ftl wraps this in #kc-info, which the stylesheet pulls flush with the card
             edges as a footer strip, the same one login.ftl uses for "New user? Register". -->
        <span>${kcSanitize(msg("backToLogin"))?no_esc}</span>
    </#if>
</@layout.registrationLayout>
